import { adminUserRepository } from "../../repositories/adminUser.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { signAuthToken, verifyAuthToken } from "../../utils/jwt.js";
import { verifyPassword } from "../../utils/password.js";
import type { AuthProvider, AuthenticatedPrincipal, LoginResult } from "./AuthProvider.js";

export const localJwtAuthProvider: AuthProvider = {
  async login(email, password): Promise<LoginResult> {
    const adminUser = await adminUserRepository.findByEmail(email.toLowerCase().trim());

    // Same generic error whether the email doesn't exist or the password is
    // wrong — avoids leaking which emails are registered admin accounts.
    if (!adminUser || !adminUser.isActive) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    const passwordMatches = await verifyPassword(password, adminUser.passwordHash);
    if (!passwordMatches) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    await adminUserRepository.touchLastLogin(adminUser.id);

    const principal: AuthenticatedPrincipal = {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role.name,
    };

    const token = signAuthToken({ sub: adminUser.id, email: adminUser.email, role: adminUser.role.name });

    return { token, user: principal };
  },

  async verifyToken(token): Promise<AuthenticatedPrincipal> {
    let payload;
    try {
      payload = verifyAuthToken(token);
    } catch {
      throw ApiError.unauthorized("Invalid or expired session");
    }

    const adminUser = await adminUserRepository.findById(payload.sub);
    if (!adminUser || !adminUser.isActive) {
      throw ApiError.unauthorized("Account no longer active");
    }

    return {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role.name,
    };
  },
};
