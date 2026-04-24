# Togalma CLI

Un outil en ligne de commande (CLI) pour **se connecter**, **voir le menu**, **créer une commande** et **payer (Wave)** chez Togalma.

> Package npm: `@togalma/cli`

---

## Français

### Installation

Prérequis: **Node.js 18+**

```bash
npm i -g @togalma/cli
```

### Démarrage rapide

```bash
togalma auth register
togalma auth login
togalma menu
togalma order create
```

### Commandes

```bash
# Auth
togalma auth register
togalma auth login
togalma auth logout
togalma auth whoami

# Menu (interactif)
togalma menu

# Commandes
togalma order create
togalma order pay <recOrderId>
togalma orders list
togalma orders show <recOrderId>
```

### Configuration (variables d’environnement)

- **`TOGALMA_BASE_URL`**: URL de base (ex: `https://togalma.com`). Par défaut, le CLI utilise `https://togalma.com`.
- **`TOGALMA_SESSION_PATH`**: chemin complet du fichier de session JSON (override). Utile si vous voulez contrôler où est stockée la session.
- **`TOGALMA_NO_SPLASH=1`**: désactive l’animation au démarrage du menu.
- **`TOGALMA_NO_UPDATE_CHECK=1`**: désactive la vérification de mise à jour (sinon, max 1 fois/jour).

### Où la session est stockée ?

Le CLI sauvegarde un fichier JSON contenant votre **token** (session locale). Par défaut le chemin est déterminé via `env-paths` (dépend de l’OS).

- **Important**: ne partagez jamais ce fichier. Si vous pensez qu’il a fuité, faites `togalma auth logout` (puis reconnectez-vous).

### Notes sécurité

- Le **PIN** n’est jamais stocké par le CLI.
- Le token est stocké localement dans un fichier de session.
- En cas de besoin, utilisez `TOGALMA_SESSION_PATH` pour stocker la session dans un emplacement chiffré / sécurisé.

### Dépannage

- **Erreur 426 (Upgrade Required)**: l’API demande une version plus récente du CLI. Mettez à jour:

```bash
npm i -g @togalma/cli@latest
```

- **`EPIPE`** (ex: `togalma ... | head`): c’est normal quand la sortie est coupée par un pipe; le CLI termine proprement.
- **Pas d’animation**: si votre terminal n’est pas un TTY, l’animation est automatiquement ignorée. Vous pouvez aussi forcer `TOGALMA_NO_SPLASH=1`.

---

## English

### Install

Prerequisite: **Node.js 18+**

```bash
npm i -g @togalma/cli
```

### Quickstart

```bash
togalma auth register
togalma auth login
togalma menu
togalma order create
```

### Commands

```bash
# Auth
togalma auth register
togalma auth login
togalma auth logout
togalma auth whoami

# Interactive menu
togalma menu

# Orders
togalma order create
togalma order pay <recOrderId>
togalma orders list
togalma orders show <recOrderId>
```

### Configuration (environment variables)

- **`TOGALMA_BASE_URL`**: base URL (e.g. `https://togalma.com`). Defaults to `https://togalma.com`.
- **`TOGALMA_SESSION_PATH`**: full path to the JSON session file (override).
- **`TOGALMA_NO_SPLASH=1`**: disables the menu splash animation.
- **`TOGALMA_NO_UPDATE_CHECK=1`**: disables update checks (otherwise at most once/day).

### Where is the session stored?

The CLI stores a local JSON session file that includes your **token**. The default location is computed using `env-paths` (OS-specific).

- **Important**: never share this file. If you suspect it leaked, run `togalma auth logout` and log in again.

### Security notes

- The CLI never stores your **PIN**.
- Your token is stored locally in the session file.
- Use `TOGALMA_SESSION_PATH` if you want the session stored in a more secure/encrypted location.

### Troubleshooting

- **426 (Upgrade Required)**: the API requires a newer CLI version. Update:

```bash
npm i -g @togalma/cli@latest
```

- **`EPIPE`** (e.g. piping to `head`): expected when the pipe closes early; the CLI exits cleanly.
- **No animation**: when not running in a TTY, splash is skipped automatically. You can also set `TOGALMA_NO_SPLASH=1`.