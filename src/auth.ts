import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export type AuthPayload = {
  userId: string;
  username: string;
};

export type AuthRequest = Request & { auth?: AuthPayload };

const getSecret = () => process.env.JWT_SECRET || "local-dev-secret-change-me";

export const signToken = (payload: AuthPayload) =>
  jwt.sign(payload, getSecret(), { expiresIn: "7d" });

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = header.replace("Bearer ", "");
  try {
    req.auth = jwt.verify(token, getSecret()) as AuthPayload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};
