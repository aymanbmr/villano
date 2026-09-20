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

- `#/caisse` — prise de commande, commandes en cours, encaissement, tickets
- `#/admin/menu` — produits (nom, catégorie, prix, stock, photo, visible/masqué) et catégories
- `#/admin/employes` — employés (serveur, caissier, barman, cuisinier, femme de ménage, manager), salaire, téléphone, code PIN, actif/parti

## API (préfixe `/api`)

Toutes les routes exigent `Authorization: Bearer <token>` sauf `POST /auth/login` ; les routes d'écriture produits/catégories et tout `/employees` exigent le rôle manager ou admin.

| Méthode | Route | Description |
| --- | --- | --- |
| POST | /auth/login | `{ pin }` ou `{ password }` → `{ token, user }` |
| GET | /auth/me | Utilisateur connecté |

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
| GET     | /orders?status=pending  | Commandes (`pending` = en cours, `paid`, `cancelled`) |
| POST    | /orders                 | Envoyer une commande en cuisine (réserve le stock, statut `pending`) |
| POST    | /orders/:id/items       | Ajouter des articles à une commande en cours |
| PATCH   | /orders/:id             | Modifier table / type / note d'une commande en cours |
| PATCH   | /orders/:id/items/:itemId | Changer la quantité d'une ligne (`{ quantity: 0 }` la retire) |
| DELETE  | /orders/:id             | Supprimer une commande en cours (remet le stock) |
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

## Utilisation sur téléphone / tablette (iOS et Android)

L'application est une **PWA** : elle s'installe sur l'écran d'accueil et se lance en plein écran comme une app native, sans App Store.

1. Le téléphone et le PC doivent être sur le **même Wi-Fi**. Trouver l'IP du PC (`ipconfig` → Adresse IPv4, ex. `192.168.1.2`).
2. Sur le téléphone, ouvrir `http://<IP-du-PC>:5173` dans **Safari** (iPhone) ou **Chrome** (Android).
3. **iPhone** : bouton Partager → « Sur l'écran d'accueil ». **Android** : menu ⋮ → « Installer l'application ».
4. Lancer « Villano » depuis l'écran d'accueil : caisse et admin (selon le rôle) sont adaptés au format téléphone.

En production, servir l'app en **HTTPS** (certificat) pour que l'installation soit proposée automatiquement et que le mode hors-ligne soit possible.

## Impression des tickets

Trois tickets, formatés pour une imprimante thermique 80 mm et envoyés via la
boîte d'impression du navigateur (choisir l'imprimante ticket, désactiver les
en-têtes/pieds de page) :

- **Bon de cuisine** — bouton « 🖨 Cuisine » sur une commande en cours, ou
  automatiquement à l'envoi si la case « Imprimer le bon de cuisine à l'envoi »
  est cochée (mémorisée sur le poste). Lors d'un ajout d'articles, seul l'ajout
  est imprimé.
- **Addition** — bouton « 🖨 Addition » (pré-note, marquée « Non payé »).
- **Ticket de caisse** — bouton « 🖨 Imprimer le ticket » après encaissement.

Nom, adresse, téléphone et message de pied de page : `frontend/src/config.ts`.

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
