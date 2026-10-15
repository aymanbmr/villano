# Villano — Café & Restaurant

Application de gestion pour café/restaurant : caisse, menu, stock (et plus tard : employés).

- `frontend/` — React 19 + Vite + TypeScript (page Menu / Caisse)
- `backend/`  — NestJS 12 + TypeORM + SQLite (API REST, images, commandes)

## Lancer en développement

```bash
npm run install:all   # une seule fois
npm run dev           # démarre l'API (port 3000) et le front (port 5173)
```

Puis ouvrir http://localhost:5173

Au premier démarrage la base `backend/villano.sqlite` est créée et remplie
avec un menu d'exemple (catégories, produits, images de démonstration).

## Connexion

L'application est verrouillée par un écran de connexion :

- **Code PIN** (clavier tactile) : tout employé actif ayant un PIN dans sa fiche accède à la caisse. Les employés de poste **Manager** accèdent aussi à l'admin.
- **Mot de passe administrateur** : défini par `ADMIN_PASSWORD` dans `backend/.env` (copier `.env.example`). Par défaut `admin1234` — **à changer**. C'est le seul accès tant qu'aucun manager n'existe.

La session dure `JWT_EXPIRES_IN` (14 h par défaut), bouton **Déconnexion** en haut à droite. Les PIN sont uniques.

## Pages

- `#/caisse` — prise de commande encaissée aussitôt, commandes du jour, tickets
- `#/admin/dashboard` — tableau de bord : chiffre d'affaires, commandes, ticket moyen, articles vendus (avec variation vs période précédente), CA par jour et par heure, espèces/carte, meilleures ventes, ventes par catégorie, produits sans vente
- `#/admin/ventes` — détail de chaque commande encaissée ou annulée (lignes, paiement, remise), recherche, réimpression du ticket, annulation
- `#/admin/menu` — produits (nom, catégorie, prix, stock, photo, visible/masqué) et catégories
- `#/admin/employes` — employés (serveur, caissier, barman, cuisinier, femme de ménage, manager), salaire, téléphone, code PIN, actif/parti

## Données de démonstration

Pour voir le tableau de bord avec un mois d'activité fictive :

```bash
cd backend
npm run seed:demo             # ajoute ~850 commandes sur 31 jours (note « Démo »)
npm run seed:demo -- --clear  # les retire
```

Le stock n'est pas modifié par ces commandes.

## API (préfixe `/api`)

Toutes les routes exigent `Authorization: Bearer <token>` sauf `POST /auth/login` ; les routes d'écriture produits/catégories et tout `/employees` exigent le rôle manager ou admin.

| Méthode | Route | Description |
| --- | --- | --- |
| POST | /auth/login | `{ pin }` ou `{ password }` → `{ token, user }` |
| GET | /auth/me | Utilisateur connecté |
| GET | /stats?from=AAAA-MM-JJ&to=AAAA-MM-JJ | Statistiques de vente de la période (admin) |
| GET | /orders?status=paid&from=&to= | Historique filtré par dates |

| Méthode | Route                   | Description                                  |
| ------- | ----------------------- | -------------------------------------------- |
| GET     | /categories             | Liste des catégories                         |
| POST    | /categories             | Créer une catégorie `{ name, icon?, sortOrder? }` |
| PATCH   | /categories/:id         | Modifier                                     |
| DELETE  | /categories/:id         | Supprimer                                    |
| GET     | /products               | Liste des produits (`?categoryId=` optionnel) |
| POST    | /products               | Créer `{ name, price, stock?, categoryId?, description?, lowStockThreshold? }` |
| PATCH   | /products/:id           | Modifier (prix, stock, disponibilité…)       |
| PATCH   | /products/:id/stock     | Ajuster le stock `{ delta: +10 }` / `{ delta: -2 }` |
| POST    | /products/:id/image     | Envoyer une photo (multipart, champ `image`) |
| DELETE  | /products/:id           | Supprimer                                    |
| GET     | /employees              | Employés actifs (`?all=1` pour inclure les anciens) |
| POST    | /employees              | Créer `{ firstName, lastName, role, phone?, salary?, hireDate?, pin?, notes? }` |
| PATCH   | /employees/:id          | Modifier (dont `isActive`)                   |
| DELETE  | /employees/:id          | Supprimer                                    |
| GET     | /orders?status=paid     | Commandes (`paid`, `cancelled`) |
| POST    | /orders                 | Envoyer une commande en cuisine (réserve le stock, statut `pending`) |
| POST    | /orders/:id/items       | Ajouter des articles ; le montant encaissé suit |
| PATCH   | /orders/:id             | Modifier le type, le serveur ou la note d'une commande |
| PATCH   | /orders/:id/items/:itemId | Changer la quantité d'une ligne (`{ quantity: 0 }` la retire) |
| DELETE  | /orders/:id             | Réservé aux commandes non soldées d'anciennes bases |
| PATCH   | /orders/:id/pay         | Encaisser `{ paymentMethod, amountPaid?, discount? }` |
| PATCH   | /orders/:id/cancel      | Annuler (remet le stock)                     |

Les images sont servies sur `http://localhost:3000/uploads/...`.

Flux en salle : la commande est envoyée (`POST /orders`), le client mange,
puis on encaisse (`PATCH /orders/:id/pay`). Pour payer tout de suite
(à emporter), ajouter `"payment": { "paymentMethod": "cash", "amountPaid": 50 }`
à la création.

```json
{
  "items": [{ "productId": 1, "quantity": 2 }],
  "orderType": "dine_in",
  "tableNumber": "4",
  "note": "sans sucre"
}
```

## Remplacer les images de démonstration

```bash
curl -F "image=@photo.jpg" http://localhost:3000/api/products/1/image
```

(un écran d'administration des produits est prévu dans une prochaine étape)

## Installation sur le PC de la caisse (Windows)

1. Installer **Node.js LTS** : https://nodejs.org (Suivant, Suivant…).
2. Récupérer le projet sur le PC : `git clone https://github.com/aymanbmr/villano.git` ou GitHub → **Code → Download ZIP** puis décompresser.
3. Double-cliquer sur **`desktop\install.cmd`** : installe, compile et crée le raccourci **Villano** sur le Bureau.
4. Double-cliquer sur **Villano**. Premier accès avec le mot de passe admin (`backend\.env`), puis créer les employés et leurs PIN.

Mise à jour : `git pull` (ou nouveau ZIP) puis relancer `desktop\install.cmd`.

## Application de bureau (Windows)

Un raccourci **Villano** sur le Bureau ouvre l'app dans sa propre fenêtre, sans
barre d'adresse ni onglets, et démarre le serveur si besoin (une seule fenêtre
« Villano - serveur » réduite dans la barre des tâches : la fermer arrête l'app).

```powershell
npm run build                                              # après chaque mise à jour du code
powershell -ExecutionPolicy Bypass -File desktop\create-shortcut.ps1   # crée le raccourci (une fois)
```

En mode bureau, le serveur sert aussi l'app compilée : tout tourne sur
http://localhost:3000 (les autres postes/téléphones du Wi-Fi utilisent
`http://<IP-du-PC>:3000`). `npm run dev` reste le mode développement.

## Utilisation sur téléphone / tablette (iOS et Android)

L'application est une **PWA** : elle s'installe sur l'écran d'accueil et se lance en plein écran comme une app native, sans App Store.

1. Le téléphone et le PC doivent être sur le **même Wi-Fi**. Trouver l'IP du PC (`ipconfig` → Adresse IPv4, ex. `192.168.1.2`).
2. Sur le téléphone, ouvrir `http://<IP-du-PC>:5173` dans **Safari** (iPhone) ou **Chrome** (Android).
3. **iPhone** : bouton Partager → « Sur l'écran d'accueil ». **Android** : menu ⋮ → « Installer l'application ».
4. Lancer « Villano » depuis l'écran d'accueil : caisse et admin (selon le rôle) sont adaptés au format téléphone.

En production, servir l'app en **HTTPS** (certificat) pour que l'installation soit proposée automatiquement et que le mode hors-ligne soit possible.

## Prise de commande

Une commande est **encaissée au moment où elle est saisie** : on choisit le
serveur responsable, sur place ou à emporter, espèces ou carte, et c'est fait.
Il n'y a pas d'étape « en cours » à solder plus tard.

Le serveur choisi répond de la commande et de l'argent qu'elle rapporte, ce qui
alimente le détail de fin de journée : combien chaque serveur a encaissé, en
espèces et par carte.

Ensuite, depuis l'onglet **Du jour** :

- **Articles** ajoute des lignes à une commande déjà encaissée ; le total suit,
  et le montant encaissé avec lui, le serveur ayant pris la différence.
- **Annuler la commande** la retire du chiffre d'affaires sans l'effacer : elle
  reste dans l'historique, marquée annulée, et le stock est remis.
- **Corriger** rectifie le règlement — passer d'espèces à carte, appliquer une
  remise, ou noter le montant réellement reçu.

Il n'y a **pas de numéro de table**. La distinction sur place / à emporter est
conservée, elle apparaît sur les tickets et dans les statistiques.

## Journée de caisse

La caisse ne prend des commandes que si la journée est ouverte.

- **Ouvrir / clôturer la journée** : réservé au **caissier**, au **manager** et à
  l'**administrateur**, et toujours manuel (rien ne s'ouvre tout seul à la connexion).
- À la connexion, si aucune journée n'est ouverte, une **fenêtre** propose
  « Ouvrir la journée » (bouton « Plus tard » pour la fermer sans ouvrir).
- Un serveur, barman ou cuisinier voit à la place « Caisse fermée — le caissier
  doit ouvrir la journée » ; une fois la journée ouverte il prend les commandes
  normalement, mais ne peut pas la clôturer.
- Si la fenêtre a été fermée et qu'on tente d'envoyer une commande, elle
  réapparaît avec le message du serveur.
- La règle est appliquée aussi côté serveur (403), donc impossible à contourner
  depuis un téléphone.

## Gestion du stock (désactivée)

La gestion du stock est masquée : aucun compteur n'apparaît sur la caisse ni
dans l'admin, aucun produit n'est bloqué parce qu'il serait épuisé, et les
quantités ne bougent plus lors des ventes.

Pour la réactiver, deux réglages doivent correspondre :

- `frontend/src/config.ts` : `SHOW_STOCK = true`
- `backend/.env` : `STOCK_ENABLED=true`

puis `npm run build` et relancer Villano. Les quantités enregistrées avant la
désactivation sont conservées : prévoir un inventaire avant de s'y fier.

## Identité visuelle

Le logo Villano est utilisé partout : barre de l'application, écran de
connexion, fenêtre d'ouverture de journée, tickets imprimés, icônes
(navigateur, bureau Windows, application mobile).

Sources : `brand/villano-logo.png` (original) et `frontend/public/logo/`
(marque seule et logo complet, en noir et en blanc, fond transparent).

Le thème reprend le logo : noir, blanc et gris. Les couleurs ne servent plus
qu'aux signaux de la caisse (stock, encaissé, erreur) et à distinguer
espèces/carte sur le tableau de bord.

## Compatibilité des anciennes caisses

Aucun emoji n'est affiché dans l'application : les postes anciens (Windows 7)
n'ont pas de police emoji et afficheraient des carrés vides. Tout est dessiné
en SVG :

- icônes de l'interface (boutons, onglets, clavier) ;
- icônes de catégories, choisies dans une liste (Admin, Menu & stock,
  panneau Catégories, bouton icône) ;
- images de produits générées : dégradé + initiales du produit.

Les catégories créées avant ce changement (emoji en base) sont converties
automatiquement au démarrage du serveur. Pour régénérer les images de
démonstration : `cd backend && npm run fix:images`.

## Écrans supportés

L'interface s'adapte de 320 px (petit téléphone) aux grands écrans :

| Écran | Caisse |
| --- | --- |
| Téléphone (portrait) | menu et commande en plein écran, barre de navigation en bas |
| Téléphone (paysage) | menu + commande côte à côte, tout compacté |
| Tablette portrait | même principe que le téléphone, 3 colonnes de produits |
| Tablette paysage / PC | menu à gauche, commande à droite |
| Grand écran (≥ 1700 px) | panneau de commande et cartes produits élargis |

Côté admin, les tableaux deviennent des cartes sous 860 px, le panneau
Catégories passe sous le tableau en dessous de 1400 px, et la barre du haut
retire progressivement ses libellés quand la largeur diminue. Sur écran
tactile, tous les boutons font au moins 38 px.

## Mode hors ligne (coupure réseau)

Si le serveur devient injoignable (Wi-Fi coupé, PC serveur redémarré), la
caisse continue de fonctionner :

- le menu, les photos et l'application elle-même sont en cache (service worker) ;
- les commandes prises, encaissées, modifiées ou annulées sont enregistrées sur
  le poste et marquées « hors ligne » ; un bandeau orange indique le nombre en attente ;
- dès que le serveur répond à nouveau, tout est envoyé automatiquement avec
  l'heure réelle de la commande et du paiement ;
- chaque commande porte un identifiant unique généré par la caisse : un envoi
  rejoué ne crée jamais de doublon.

À savoir : les tickets imprimés hors ligne portent un numéro provisoire
(« Hors ligne #1 ») ; le numéro définitif est attribué à la synchronisation.
Si un produit manquait de stock, la commande est quand même enregistrée (le
stock peut devenir négatif, à corriger dans Admin → Menu & stock). En cas de
refus du serveur, le bandeau affiche l'erreur et propose de réessayer ou
d'abandonner.

## Impression des tickets

Trois tickets, formatés pour une imprimante thermique 80 mm :

- **Bon de cuisine** — bouton « Cuisine » sur une commande en cours, ou
  automatiquement à l'envoi si la case **« Imprimer le bon de cuisine à
  l'envoi »** est cochée. Lors d'un ajout d'articles, seul l'ajout est imprimé.

  Cette case est le **même interrupteur** que « Envoi automatique » dans
  Admin → Imprimantes : le réglage vit sur le serveur, pas dans chaque
  navigateur, pour que la caisse, le téléphone d'un serveur et l'écran
  d'administration ne puissent pas se contredire. Elle est accessible à la
  caisse, alors que les adresses des imprimantes restent réservées à
  l'administration.
- **Addition** — bouton « Addition » (pré-note, marquée « Non payé »).
- **Ticket de caisse** — sort **automatiquement à l'encaissement**, sans que
  personne ne le demande ; le bouton de réimpression reste disponible dans
  l'historique des ventes.

Un ticket parti **tout seul** n'ouvre jamais la boîte d'impression du
navigateur : celle-ci est modale et figerait la caisse à chaque vente. Quand le
serveur ne peut pas imprimer, l'application le dit — « ticket non imprimé » —
et laisse la caisse utilisable. La boîte ne s'ouvre que sur un clic explicite,
où l'attente est voulue.

Pour que le ticket parte sans qu'aucune fenêtre ne s'ouvre, il faut une
imprimante réseau configurée : le serveur lui parle directement. À défaut,
c'est le navigateur qui imprime, et il affiche sa boîte de dialogue — sauf si
la caisse est lancée par les raccourcis du dossier `desktop/`, qui passent
`--kiosk-printing` à Chrome pour envoyer directement sur l'imprimante par
défaut de Windows.

### Deux imprimantes réseau (comptoir + cuisine)

Dans **Admin → Imprimantes**, bouton **« Lancer la recherche »** : le serveur
parcourt le réseau sur lequel il se trouve et liste tout ce qui répond aux
imprimantes, avec son adresse et son numéro réseau. Il ne reste qu'à affecter
chaque ligne au comptoir ou à la cuisine. L'adresse peut aussi être saisie à la
main (port 9100, celui que toutes les imprimantes ticket réseau écoutent) :

- **Comptoir** — additions et tickets de caisse.
- **Cuisine** — bons de préparation, sans les prix, articles en double
  hauteur pour être lus depuis le passe.

Le bouton « Imprimer une page de test » de chaque carte enregistre les
réglages puis envoie un ticket de contrôle : s'il ne sort pas, le message
indique si l'imprimante est injoignable ou si elle refuse la connexion.

#### Développer sans imprimante

La fenêtre d'impression de Chrome n'appartient pas à l'application : elle
apparaît dès qu'on passe par le navigateur, c'est-à-dire quand aucune
imprimante réseau n'est configurée. Pour voir le fonctionnement réel sans
matériel, le projet embarque une imprimante simulée :

```bash
cd backend && npm run fake:printer
```

Elle écoute sur le port 9100 comme une vraie et affiche les tickets dans le
terminal, commandes ESC/POS traduites. Mettez ensuite `127.0.0.1` dans
Admin → Imprimantes, cochez « Activée », enregistrez : les tickets partent
alors tout seuls, sans que rien ne s'ouvre à l'écran.

Si vous tenez à imprimer par le navigateur sans fenêtre, il faut lancer Chrome
avec `--kiosk-printing`, ce que font les raccourcis du dossier `desktop/`. Le
ticket part alors sur l'imprimante par défaut de Windows — mais si cette
imprimante par défaut est « Microsoft Print to PDF », Windows demandera où
enregistrer le fichier, et la fenêtre réapparaîtra.

#### Changer de box, de Wi-Fi, de réseau

Une imprimante est jointe par son adresse IP, et une adresse IP appartient à un
réseau : changez de box, déplacez la caisse, laissez le routeur redistribuer ses
baux, et l'adresse enregistrée ne pointe plus sur rien.

Villano ne s'y fie donc pas seule. Chaque imprimante est aussi mémorisée par son
**numéro réseau** (adresse MAC), gravé en usine et que rien ne change. Quand
l'adresse enregistrée ne répond plus, le serveur balaie le réseau, reconnaît
l'imprimante à ce numéro, enregistre sa nouvelle adresse et imprime — sans que
personne n'ouvre les réglages. Le numéro est capté à la recherche, ou à la
première page de test réussie.

Cela vaut pour le réseau où se trouve le serveur. Une imprimante réglée en IP
fixe sur un autre sous-réseau que celui du café (par exemple 192.168.123.100
alors que le café est en 192.168.1.x, réglage d'usine fréquent) reste invisible
de tout le monde : il faut la remettre une fois en DHCP ou dans la bonne plage,
avec l'utilitaire du fabricant en USB, ou depuis un PC filaire auquel on ajoute
une adresse temporaire dans le sous-réseau de l'imprimante :

```
netsh interface ipv4 add address name="NOM" addr=192.168.123.50 mask=255.255.255.0
netsh interface ipv4 delete address name="NOM" addr=192.168.123.50
```

#### Une seule imprimante

Si la cuisine n'a pas d'imprimante, laissez sa carte désactivée : les bons de
cuisine sortent alors sur celle du comptoir plutôt que de ne pas sortir.

C'est **le serveur** qui parle aux imprimantes, pas le navigateur. Une commande
envoyée depuis le téléphone d'un serveur imprime donc son bon en cuisine sans
que le téléphone soit relié à quoi que ce soit ; l'option « Imprimer le bon en
cuisine dès qu'une commande est envoyée » gouverne cet envoi automatique. Une
imprimante éteinte n'empêche jamais d'enregistrer la commande.

Tant qu'aucune imprimante n'est configurée, l'application retombe sur la boîte
d'impression du navigateur (choisir l'imprimante ticket, désactiver les
en-têtes/pieds de page) — c'est aussi le repli quand le serveur est
injoignable.

En-tête des tickets réseau (nom, adresse, téléphone, message de fin) :
Admin → Imprimantes. Pour les tickets du navigateur : `frontend/src/config.ts`.

## Base de données : SQLite ou PostgreSQL

Les deux moteurs sont pris en charge, et c'est `backend/.env` qui tranche.

**Sans rien configurer, c'est SQLite** : un seul fichier, `backend/villano.sqlite`,
créé tout seul au premier démarrage. Aucun service à installer, une sauvegarde
est une copie de fichier, et déménager la caisse revient à copier ce fichier.
C'est ce qu'il faut sur le PC du café.

**`DATABASE_URL` renseignée, c'est PostgreSQL** :

```
DATABASE_URL=postgres://villano:motdepasse@127.0.0.1:5432/villano
```

Les montants sont stockés en `double precision`, l'équivalent exact du `real`
de SQLite, afin que les deux moteurs calculent les totaux au centime près de la
même façon. `numeric` serait plus orthodoxe pour de l'argent, mais le pilote
PostgreSQL rend les `numeric` sous forme de chaînes de caractères, et
`total + total` concaténerait au lieu d'additionner — une erreur silencieuse
sur un ticket de caisse, c'est exactement ce qu'il ne faut pas.

### `synchronize` : le vrai danger

TypeORM sait reconstruire le schéma à partir du code à chaque démarrage. C'est
commode tant que le schéma bouge, et dangereux dès que la base contient les
ventes réelles : une colonne renommée est supprimée puis recréée vide.

Le comportement par défaut suit donc le moteur — actif en SQLite (poste de
développement), inactif en PostgreSQL (serveur hébergé). `DB_SYNC=true` le
force, le temps de créer les tables sur une base neuve.

## Déploiement avec Docker (recommandé)

L'application et sa base démarrent en une commande, à l'identique sur votre
machine et sur le serveur — ce qui marche ici marchera là-bas.

```bash
cp .env.docker.example .env     # puis y mettre les mots de passe
docker compose up -d --build
```

L'application répond sur `http://localhost:3000`. Les deux secrets se tirent
au hasard avec `openssl rand -hex 32`.

Pour un serveur exposé à internet, le profil `proxy` ajoute Caddy devant, qui
obtient et renouvelle le certificat HTTPS tout seul :

```bash
DOMAIN=villano.exemple.ma docker compose --profile proxy up -d --build
```

| Besoin | Commande |
| --- | --- |
| Journaux en direct | `docker compose logs -f app` |
| Mettre à jour | `git pull && docker compose up -d --build` |
| Arrêter | `docker compose down` |
| Sauvegarder la base | `docker compose exec db pg_dump -U villano villano \| gzip > villano.sql.gz` |
| Restaurer | `gunzip -c villano.sql.gz \| docker compose exec -T db psql -U villano villano` |

Les données vivent dans des volumes Docker, pas dans les conteneurs : la base
dans `db-data`, les photos des produits dans `uploads`. Reconstruire l'image
ou supprimer les conteneurs ne les touche pas. `docker compose down -v`, en
revanche, les efface — c'est la seule commande à manier avec précaution.

L'image se construit en deux temps : une première contient les compilateurs et
les dépendances de développement, et seul le résultat passe dans l'image
finale. Au démarrage, le conteneur attend que PostgreSQL accepte vraiment les
connexions, puis crée le schéma **uniquement si la base est vierge** — sur une
base contenant les ventes, il ne touche à rien.

### Vérifier l'heure du serveur

Les journées de caisse et les statistiques raisonnent en **heure locale du
serveur** : le jour d'une vente, la courbe par heure et les bornes d'une
période en dépendent. Un conteneur laissé en UTC compterait une commande
encaissée à 00h30 sur la veille.

Le fuseau est donc fixé à `Africa/Casablanca`, et se change par `TZ` dans le
`.env`. Après le démarrage, comparez :

```bash
docker compose exec app date
```

L'heure affichée doit être celle de la pendule du café. Si elle est décalée
d'une heure, c'est que la base de fuseaux et la règle marocaine en vigueur ne
coïncident pas — les règles ont changé plusieurs fois, et le décalage du
Ramadan s'y ajoute. Forcez alors un décalage fixe plutôt qu'une zone :

```
TZ=Etc/GMT-1     # pour UTC+1 — le signe est inversé, ce n'est pas une faute
TZ=UTC           # pour UTC+0
```

Un décalage fixe ne suivra plus les changements de règle, mais il affiche la
bonne heure, ce qui est tout ce qui compte pour la caisse.

### Reprendre les données de la caisse

```bash
docker compose cp backend/villano.sqlite app:/tmp/villano.sqlite
docker compose exec app node dist/scripts/sqlite-to-postgres.js /tmp/villano.sqlite
```

Le script compilé est appelé directement : l'image de production ne contient
pas le compilateur, et `npm run migrate:postgres` commence par recompiler.

Même raison pour l'historique de démonstration, utile pour voir le tableau de
bord se remplir — un mois de ventes réparties entre les serveurs actifs :

```bash
docker compose exec app node dist/scripts/seed-demo.js
docker compose exec app node dist/scripts/seed-demo.js --clear   # les retirer
```

## Hébergement sur un VPS sans Docker (dossier `deploy/`)

Le serveur sert aussi l'application compilée, donc un seul processus sur un
seul port suffit. Tout est prêt pour un VPS Ubuntu 22.04 ou 24.04 ; la plus
petite machine convient (1 vCPU, 1 Go de RAM), la base étant un simple fichier
SQLite.

```bash
# sur le VPS, en root
git clone https://github.com/aymanbmr/villano.git /opt/villano
sudo bash /opt/villano/deploy/vps-install.sh villano.exemple.ma
```

Le script installe Node.js 22, PostgreSQL et Caddy, crée la base et
l'utilisateur de service, compile l'application, écrit `backend/.env` avec un
mot de passe admin et une clé de session tirés au hasard — **il les affiche une
seule fois, à noter** —, déclare le service systemd, ouvre le pare-feu et
programme une sauvegarde quotidienne. Caddy obtient le certificat HTTPS tout
seul : il faut simplement que le domaine pointe déjà sur l'adresse IP du VPS.

### Reprendre les données de la caisse

```bash
# copier d'abord backend/villano.sqlite du PC de la caisse vers le VPS
cd /opt/villano/backend
npm run migrate:postgres -- /chemin/vers/villano.sqlite
```

Le transfert ouvre le fichier SQLite en lecture seule et refuse d'écrire dans
une table qui contient déjà des lignes, sauf avec `--force`. Tout se fait dans
une transaction : en cas d'erreur, rien n'est écrit.

Vérifié sur la base de développement, 2 864 lignes dont 931 commandes et 1 869
lignes de commande : chiffre d'affaires, meilleures ventes, répartition par
catégorie, détail par serveur et numéros de ticket ressortent identiques des
deux côtés. Une seule différence, et c'est une amélioration : PostgreSQL trie
le menu selon l'alphabet français et place « Crêpe Nutella » avant
« Croissant », là où SQLite compare les octets bruts et rejette tous les mots
accentués après les autres.

| Besoin | Commande |
| --- | --- |
| État du service | `systemctl status villano` |
| Journaux en direct | `journalctl -u villano -f` |
| Mettre à jour | `sudo bash /opt/villano/deploy/vps-update.sh` |
| Sauvegarder maintenant | `villano-backup` |

Les sauvegardes vont dans `/var/backups/villano`, gardées 30 jours : `pg_dump`
pour PostgreSQL, `sqlite3 .backup` pour SQLite — jamais un simple `cp`, qui
donnerait un fichier incohérent si une commande était encaissée pendant la
copie. Les images partent dans une archive à part, et le script s'arrête en
erreur si la sauvegarde produite est vide, pour ne pas découvrir le problème le
jour de la restauration. Une sauvegarde précède chaque mise à jour.

### Imprimer quand le serveur est hébergé

Un serveur dans un datacenter ne peut pas joindre une imprimante du café :
`192.168.1.95` n'existe que sur le réseau local, et des millions de réseaux ont
une machine à cette adresse. La recherche d'imprimantes ne trouvera rien — elle
balaie le réseau du datacenter — et une adresse saisie à la main répondra
« imprimante injoignable ».

C'est donc le **navigateur de la caisse** qui imprime, ce PC étant sur le même
réseau que les imprimantes. Pour que ce soit silencieux :

1. Installer l'imprimante dans Windows avec un port **Standard TCP/IP** pointant
   sur son adresse, et non un port USB.
2. Lui donner un format de papier (80 × 297 mm), sinon elle attend une page
   entière qui n'arrive jamais.
3. La définir comme **imprimante par défaut** de Windows.
4. Lancer la caisse par le raccourci du dossier `desktop/`, qui passe
   `--kiosk-printing` à Chrome et supprime la fenêtre d'impression.
5. Laisser **Admin → Imprimantes vide**. Une adresse configurée mais injoignable
   ferait patienter avant chaque ticket, le temps que le serveur renonce.

Ce que cela coûte : seule la caisse imprime. Une commande prise sur le
téléphone d'un serveur ne sortira pas en cuisine toute seule, puisque le
serveur hébergé ne peut pas la relayer. Pour retrouver cela, il faudrait un
agent d'impression tournant au café — voir ci-dessous.

### Ce qu'un VPS fait perdre : l'impression directe

Les imprimantes sont sur le réseau local du café, derrière la box. Un serveur
hébergé dans un datacenter ne peut pas les joindre : l'impression réseau
décrite plus haut cesse de fonctionner, avec elle la coupe automatique et le
bon de cuisine envoyé tout seul depuis le téléphone d'un serveur.

Il reste l'impression par le navigateur de la caisse, qui passe par le pilote
Windows et la boîte d'impression. C'est ce que fait l'application dès qu'aucune
imprimante réseau n'est configurée, sans rien à changer.

Pour retrouver l'impression directe avec un serveur distant, il faudrait un
petit agent tournant au café, qui interroge le serveur et relaie les tickets
aux imprimantes du réseau local. Ce n'est pas écrit à ce jour.

### Choisir entre VPS et serveur au café

Le VPS vaut pour un accès depuis n'importe où, une adresse stable, des
sauvegardes régulières et l'absence de PC à laisser allumé. Il coûte en
revanche l'impression directe, et une coupure internet au café fait basculer la
caisse en mode hors ligne — les commandes continuent d'être prises et se
synchronisent au retour, mais le tableau de bord et l'administration restent
inaccessibles le temps de la panne.

Le serveur au café garde les imprimantes et survit aux coupures internet, au
prix d'un PC qui doit rester allumé et d'une adresse qui change avec le réseau.

Rien n'interdit de commencer par un VPS et de rapatrier plus tard, la base
étant un seul fichier à copier.

## Application native iOS / Android (dossier `mobile/`, EAS Build)

`mobile/` est une coque **Expo** : un écran natif (WebView) qui affiche
l'application. Les builds se font dans le cloud avec **EAS Build** — pas besoin
de Mac. Compte Expo (gratuit) + compte Apple Developer pour iOS.

Adresse du serveur affichée par l'app : `mobile/app.json` → `extra.appUrl`
(par défaut `http://192.168.1.2:5173`, l'IP du PC sur le Wi-Fi du restaurant).

```bash
cd mobile
npx eas login                       # compte Expo
npx eas init                        # lie le projet à votre compte (une fois)
npx eas device:create               # iOS : enregistre votre iPhone (lien à ouvrir sur le téléphone)
npm run build:ios                   # build iOS installable (demande l'identifiant Apple la 1re fois)
npm run build:android               # APK Android installable
```

À la fin du build, EAS affiche un lien / QR code : l'ouvrir sur le téléphone
pour installer l'app. Pour TestFlight / App Store : `npm run build:store` puis
`npx eas submit -p ios`.
