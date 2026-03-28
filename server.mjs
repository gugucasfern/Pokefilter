import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host}`);
    const safePath = normalizeRequestPath(requestUrl.pathname);
    const resolvedPath = path.join(workspaceRoot, safePath);
    const filePath = await resolveFilePath(resolvedPath);

    response.writeHead(200, {
      "Content-Type": getContentType(filePath),
      "Cache-Control": "no-store",
    });

    createReadStream(filePath).pipe(response);
  } catch (error) {
    const statusCode = error?.code === "ENOENT" ? 404 : 500;
    response.writeHead(statusCode, {
      "Content-Type": "text/plain; charset=utf-8",
    });
    response.end(statusCode === 404 ? "Not found" : "Server error");
  }
});

server.listen(port, () => {
  console.log(`DexQuery local server running at http://localhost:${port}`);
});

function normalizeRequestPath(requestPath) {
  const decodedPath = decodeURIComponent(requestPath);
  const normalizedPath = path.posix.normalize(decodedPath);
  const trimmedPath = normalizedPath.replace(/^(\.\.(\/|\\|$))+/, "");
  const targetPath = trimmedPath === "/" ? "/index.html" : trimmedPath;
  return targetPath.replace(/^\//, "");
}

async function resolveFilePath(candidatePath) {
  const candidateStat = await safeStat(candidatePath);

  if (candidateStat?.isDirectory()) {
    const nestedIndex = path.join(candidatePath, "index.html");
    await access(nestedIndex);
    return nestedIndex;
  }

  await access(candidatePath);
  return candidatePath;
}

async function safeStat(candidatePath) {
  try {
    return await stat(candidatePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function getContentType(filePath) {
  return contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

