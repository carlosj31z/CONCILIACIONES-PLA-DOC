import type { Role } from "@prisma/client";

export interface AuthUser {
  id: string;
  email: string;
  nombre: string;
  role: Role;
  puesto?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
