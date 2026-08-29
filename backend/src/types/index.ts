import type { Role } from "./enums";

export interface AuthUser {
  id: string;
  email: string;
  nombre: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
