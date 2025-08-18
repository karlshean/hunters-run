import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { verifyIdToken } from "./firebase";

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers["authorization"];
    if (!auth || !auth.startsWith("Bearer ")) throw new UnauthorizedException("Missing bearer token");
    try {
      const token = auth.slice(7);
      const decoded = await verifyIdToken(token);
      req.user = { uid: decoded.uid, email: decoded.email, email_verified: decoded.email_verified };
      return true;
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }
}