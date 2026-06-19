const { execSync } = require("child_process");

// Rewrite all commits by alexvivaldi to Paul Given
const filter = `
  if [ "$GIT_AUTHOR_EMAIL" = "188866078+alexvivaldi@users.noreply.github.com" ]; then
    export GIT_AUTHOR_NAME="Paul Given"
    export GIT_AUTHOR_EMAIL="paul.given@users.noreply.github.com"
    export GIT_COMMITTER_NAME="Paul Given"
    export GIT_COMMITTER_EMAIL="paul.given@users.noreply.github.com"
  fi
`.trim();

// Use git commit-tree approach — amend the specific commit
// First identify the root commit
const log = execSync("git log --format=\"%H %ae\" --all", { encoding: "utf8" });
const lines = log.trim().split("\n");

let rootHash = null;
for (const line of lines) {
  const [hash, email] = line.trim().split(" ");
  if (email && email.includes("alexvivaldi")) {
    rootHash = hash;
    console.log("Found alexvivaldi commit:", hash, email);
  }
}

if (!rootHash) {
  console.log("No alexvivaldi commits found.");
  process.exit(0);
}

// Use git-filter-repo approach via env vars in a temp script
const fs = require("fs");
const path = require("path");
const os = require("os");

const scriptPath = path.join(os.tmpdir(), "rewrite.sh");
fs.writeFileSync(scriptPath, `#!/bin/sh
if [ "$GIT_AUTHOR_EMAIL" = "188866078+alexvivaldi@users.noreply.github.com" ]; then
  export GIT_AUTHOR_NAME="Paul Given"
  export GIT_AUTHOR_EMAIL="paul.given@users.noreply.github.com"
  export GIT_COMMITTER_NAME="Paul Given"
  export GIT_COMMITTER_EMAIL="paul.given@users.noreply.github.com"
fi
`);

console.log("Script written to", scriptPath);
console.log("Run manually: git filter-branch --env-filter '" + scriptPath + "' --tag-name-filter cat -- --branches");

// Instead, do it simply: just amend the root commit
// The root commit is the one we need to change
// Create a new orphan branch, cherry-pick everything

try {
  // Get the commit message of the root commit
  const rootMsg = execSync(`git log --format="%s" ${rootHash}^!`, { encoding: "utf8" }).trim();
  const rootTree = execSync(`git log --format="%T" ${rootHash}^!`, { encoding: "utf8" }).trim();
  
  console.log("Root commit:", rootHash);
  console.log("Message:", rootMsg);
  console.log("Tree:", rootTree);
  
  // Create new root commit with Paul Given authorship
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "Paul Given",
    GIT_AUTHOR_EMAIL: "paul.given@users.noreply.github.com",
    GIT_COMMITTER_NAME: "Paul Given",
    GIT_COMMITTER_EMAIL: "paul.given@users.noreply.github.com",
    GIT_AUTHOR_DATE: execSync(`git log --format="%ad" --date=iso ${rootHash}^!`, { encoding: "utf8" }).trim(),
    GIT_COMMITTER_DATE: execSync(`git log --format="%cd" --date=iso ${rootHash}^!`, { encoding: "utf8" }).trim(),
  };
  
  const newRoot = execSync(
    `git commit-tree ${rootTree} -m "${rootMsg}"`,
    { encoding: "utf8", env }
  ).trim();
  
  console.log("New root commit:", newRoot);
  
  // Now rebase all other commits onto new root
  execSync(`git rebase --onto ${newRoot} ${rootHash} master`, { stdio: "inherit" });
  
  console.log("Done! Verify with: git log --format=\"%h %an <%ae>\"");
} catch (e) {
  console.error("Error:", e.message);
}
