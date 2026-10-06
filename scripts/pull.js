/* eslint-disable @typescript-eslint/no-require-imports */
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');

async function run() {
  console.log("Repository directory:", dir);
  console.log("Pulling latest changes from origin main...");

  try {
    await git.pull({
      fs,
      http,
      dir,
      ref: 'main',
      singleBranch: true,
      author: { name: 'User', email: 'user@example.com' }
    });
    console.log("\n✅ Successfully pulled from origin/main. Already up to date!");
  } catch (err) {
    console.error("\n❌ Pull Failed:", err.message);
  }
}

run();
