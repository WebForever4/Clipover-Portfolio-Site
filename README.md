# Clipover site

## Put it on GitHub
1. On GitHub, create a **public** repository. Name it `YOUR-USERNAME.github.io` to get `https://YOUR-USERNAME.github.io`, or any name to get `https://YOUR-USERNAME.github.io/REPO`.
2. Upload `index.html`, `clippy.jpg` and `works.json` to the repository root.
3. Go to **Settings > Pages**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then save.

## Sign in and upload
1. GitHub > Settings > Developer settings > Personal access tokens > **Fine-grained tokens** > Generate new token.
2. Under **Repository access**, choose only this repository. Under **Permissions**, set **Contents** to **Read and write**.
3. On the site, click **Sign in**, enter your username, repository name and the token.
4. Use **Add a work** to publish. Each upload is committed to the repository and appears on the site after Pages rebuilds (a minute or two).

The token is kept in your browser tab only and is sent only to api.github.com. Sign-in is checked by GitHub itself: a token without write access to the repository can't sign in or upload.
