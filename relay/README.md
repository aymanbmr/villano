# Relais d'impression Villano

À utiliser uniquement quand le serveur Villano est hébergé ailleurs qu'au
café (VPS, cloud) : il ne peut alors pas parler directement aux imprimantes
du réseau local. Ce petit programme tourne sur une machine du café branchée
au même réseau que les imprimantes, et fait le lien.

Si le serveur tourne déjà sur place (PC du café, Docker local), ce dossier
ne sert à rien : laissez « Relais local » désactivé dans Admin → Imprimantes.

## Installation

Node.js 18 ou plus récent doit être installé sur la machine (aucune autre
dépendance : le relais n'en a aucune).

```bash
cd relay
cp relay.env.example relay.env
```

Éditez `relay.env` :

- `SERVER_URL` : l'adresse du serveur Villano (celle utilisée pour l'app).
- `RELAY_TOKEN` : généré dans **Admin → Imprimantes → Relais local →
  Régénérer**, puis copié depuis là.

Puis dans **Admin → Imprimantes**, cochez **Relais local → Activé** et
renseignez les adresses IP des imprimantes comme d'habitude (celles du
réseau local du café — relevées sur l'écran de chaque imprimante, la
recherche automatique ne fonctionne plus une fois le relais activé, puisque
c'est le serveur qui chercherait sur son propre réseau, pas celui du café).

## Lancer

```bash
node relay.js
```

Le terminal affiche chaque ticket imprimé. Pour le laisser tourner en
arrière-plan sans fenêtre visible au quotidien, double-cliquez sur
`Villano-relay.cmd`, ou installez-le au démarrage de Windows :

```powershell
powershell -ExecutionPolicy Bypass -File install-startup.ps1
```

## Comment ça marche

Le serveur ne peut pas atteindre les imprimantes : au lieu d'essayer, il met
chaque ticket en attente. Le relais interroge le serveur toutes les quelques
secondes, récupère les tickets en attente et les envoie directement, en
ESC/POS brut, à l'adresse IP et au port enregistrés pour chaque imprimante —
exactement ce que ferait le serveur s'il tournait sur place.

Si une imprimante est éteinte, le ticket reste en attente et sera réessayé
au prochain passage plutôt que d'être perdu.

## Tester sans imprimante

Le projet fournit une imprimante simulée (`backend/src/scripts/fake-printer.ts`) :

```bash
cd ../backend && npm run fake:printer
```

Elle écoute sur `127.0.0.1:9100` et affiche dans son terminal ce qu'elle
reçoit. Renseignez cette adresse dans Admin → Imprimantes pour vérifier
toute la chaîne (commande → serveur → file d'attente → relais → « imprimante »)
avant de brancher du vrai matériel.
