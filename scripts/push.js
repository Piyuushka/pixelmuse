const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const token = process.argv[2] || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

async function run() {
  console.log("Repository directory:", dir);

  if (!token) {
    console.log("\n❌ GitHub Token Missing.");
    console.log("Usage: npm run push <YOUR_GITHUB_PERSONAL_ACCESS_TOKEN>");
    console.log("Example: npm run push ghp_xxxxxxxxxxxxxxxxxxxx");
    process.exit(1);
  }

  console.log("Attempting push to origin main using provided token...");

  try {
    const pushResult = await git.push({
      fs,
      http,
      dir,
      remote: 'origin',
      ref: 'main',
      url: 'https://github.com/devmanepranjal-prog/pixelmuse.git',
      onAuth: () => ({ username: token })
    });
    console.log("Push result:", pushResult);
    console.log("\n✅ SUCCESSFULLY PUSHED FRONTEND TO https://github.com/devmanepranjal-prog/pixelmuse.git !");
  } catch (err) {
    console.error("\n❌ Push Failed:", err.message);
  }
}

run();
