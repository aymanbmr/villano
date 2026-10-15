# Relais d'impression Villano

À utiliser uniquement quand le serveur Villano est hébergé ailleurs qu'au
café (VPS, cloud) : il ne peut alors pas parler directement aux imprimantes
du réseau local. Ce petit programme tourne sur une machine du café branchée
au même réseau que les imprimantes, et fait le lien.

Si le serveur tourne déjà sur place (PC du café, Docker local), ce dossier
ne sert à rien : laissez « Relais local » désactivé dans Admin → Imprimantes.

## Deux versions, selon la machine

| Fichier | Quand l'employer |
| --- | --- |
| `relay.js` | Machine récente, avec **Node.js 18 ou plus**. |
| `Villano-relay.ps1` | **Windows 7**, ou toute machine sans Node.js. **Rien à installer** : PowerShell et .NET suffisent. |

Le lanceur `Villano-relay.cmd` choisit tout seul : il prend Node s'il le
trouve en version 18 ou plus, et bascule sinon sur la version PowerShell.
C'est le cas d'une caisse sous Windows 7, où Node.js ne s'installe plus depuis
longtemps.

Les deux versions parlent le même protocole au serveur et sont
interchangeables.

## Installation

Rien à installer pour la version PowerShell. Pour `relay.js`, Node.js 18 ou
plus récent doit être présent (aucune autre dépendance).

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

Double-cliquez sur **`Villano-relay.cmd`**, qui choisit la bonne version. Ou
directement :

```bash
node relay.js                                              # Node 18+
powershell -ExecutionPolicy Bypass -File Villano-relay.ps1  # Windows 7
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

## Si le serveur répond « Internal server error »

Le relais ajoute une table `print_jobs`. Sur PostgreSQL, la reconstruction
automatique du schéma est volontairement désactivée — une colonne renommée
serait sinon vidée à chaque démarrage. Après une mise à jour qui apporte le
relais, cette table n'existe donc pas encore, et le relais reçoit une erreur
500 à chaque interrogation.

Il faut la créer une fois, en démarrant le serveur avec `DB_SYNC=true` :

```bash
# avec Docker
docker compose run --rm -e DB_SYNC=true --entrypoint sh app -c "timeout 40 node dist/main.js"

# sans Docker
cd backend && DB_SYNC=true timeout 40 node dist/main.js
```

Ajouter une table ne touche à aucune donnée existante.

## Rapidité

Le relais ne repasse plus toutes les trois secondes : il garde sa requête
ouverte, et le serveur la débloque dès qu'un ticket entre dans la file. Un
ticket part donc dans les instants qui suivent l'encaissement — mesuré à moins
de 300 ms de bout en bout, encaissement compris.

`POLL_INTERVAL_MS` ne sert plus que de garde-fou entre deux requêtes ; il est
inutile de le descendre.

Un ticket que personne n'a su livrer en dix minutes est abandonné. Sans cela,
une imprimante éteinte bloquerait toute la file derrière elle, et les tickets
oubliés finiraient par sortir en pleine heure de pointe, sans rapport avec ce
qui se passe au comptoir.
