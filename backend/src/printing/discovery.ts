// Finding the printers again, on whatever network the caisse happens to be on.
//
// A printer is addressed by IP, and an IP belongs to a network: change the box,
// move to another Wi-Fi, let the router hand out its leases differently, and the
// address the caisse was told about points at nothing. So we never rely on the
// address alone. Every printer is remembered by its MAC address — the serial
// number burnt into its network chip, which no network can change — and the IP
// is treated as a hint that can be re-derived at any time by sweeping the
// network the server itself sits on.

import { exec } from 'node:child_process';
import { Socket } from 'node:net';
import { networkInterfaces } from 'node:os';
import { promisify } from 'node:util';

const run = promisify(exec);

export interface FoundPrinter {
  host: string;
  port: number;
  /** Lower-case, colon separated; empty when the system could not resolve it. */
  mac: string;
}

/** Port 9100 is what every network thermal printer listens on ("raw" printing). */
export const RAW_PRINT_PORT = 9100;

const CONCURRENCY = 48;
const PROBE_TIMEOUT = 700;

/** The /24 networks this machine belongs to, the only ones it can sweep. */
export function localSubnets(): string[] {
  const subnets = new Set<string>();
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      subnets.add(address.address.split('.').slice(0, 3).join('.'));
    }
  }
  return [...subnets];
}

function probe(host: string, port: number, timeout = PROBE_TIMEOUT) {
  return new Promise<boolean>((resolve) => {
    const socket = new Socket();
    const done = (open: boolean) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeout);
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host, () => done(true));
  });
}

/** Runs the probes in slices: a caisse PC should not open 254 sockets at once. */
async function sweep(hosts: string[], port: number): Promise<string[]> {
  const open: string[] = [];
  for (let i = 0; i < hosts.length; i += CONCURRENCY) {
    const slice = hosts.slice(i, i + CONCURRENCY);
    const results = await Promise.all(slice.map((host) => probe(host, port)));
    slice.forEach((host, index) => {
      if (results[index]) open.push(host);
    });
  }
  return open;
}

const normalizeMac = (value: string) => value.replace(/-/g, ':').toLowerCase();

/**
 * IP to MAC, read from the system's ARP table. Sweeping the network fills that
 * table as a side effect, so this is called straight after a sweep.
 */
export async function arpTable(): Promise<Map<string, string>> {
  const table = new Map<string, string>();
  const add = (ip: string, mac: string) => {
    const clean = normalizeMac(mac);
    // Broadcast and unresolved entries say nothing about a real device
    if (clean !== 'ff:ff:ff:ff:ff:ff' && clean !== '00:00:00:00:00:00') table.set(ip, clean);
  };

  try {
    if (process.platform === 'win32') {
      const { stdout } = await run('arp -a', { windowsHide: true });
      for (const line of stdout.split('\n')) {
        const match = line.match(/(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f]{2}(?:[-:][0-9a-f]{2}){5})/i);
        if (match) add(match[1], match[2]);
      }
    } else {
      const { stdout } = await run('ip neigh show');
      for (const line of stdout.split('\n')) {
        const match = line.match(/^(\d+\.\d+\.\d+\.\d+).*lladdr\s+([0-9a-f:]{17})/i);
        if (match) add(match[1], match[2]);
      }
    }
  } catch {
    // No ARP table available: discovery still works, just without MAC addresses
  }
  return table;
}

/** Every device on this machine's networks answering on the printing port. */
export async function discoverPrinters(port = RAW_PRINT_PORT): Promise<FoundPrinter[]> {
  const hosts = localSubnets().flatMap((subnet) =>
    Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`),
  );
  const open = await sweep(hosts, port);
  const macs = await arpTable();
  return open.map((host) => ({ host, port, mac: macs.get(host) ?? '' }));
}

/**
 * Where a printer moved to. Returns its current address, or null when nothing on
 * the network carries that MAC — unplugged, switched off, or on another network.
 */
export async function findByMac(mac: string, port = RAW_PRINT_PORT): Promise<string | null> {
  if (!mac) return null;
  const wanted = normalizeMac(mac);
  const found = await discoverPrinters(port);
  return found.find((printer) => printer.mac === wanted)?.host ?? null;
}

/** Whether a printer is answering at the address we have on file. */
export const reachable = (host: string, port: number) => probe(host, port, 1200);
