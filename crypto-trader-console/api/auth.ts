import { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization;

  const mockUser = "admin";
  const mockPass = "12345";

  if (!auth) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Restricted Area"');
    res.status(401).send("Auth required");
    return;
  }

  const b64auth = auth.split(" ")[1];
  const [user, pass] = Buffer.from(b64auth, "base64").toString().split(":");

  if (user === mockUser && pass === mockPass) {
    res.status(200).send("Authorized");
    return;
  }

  res.setHeader("WWW-Authenticate", 'Basic realm="Restricted Area"');
  res.status(401).send("Auth required");
}
