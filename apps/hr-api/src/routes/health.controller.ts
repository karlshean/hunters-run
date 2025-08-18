import { Controller, Get, Req } from "@nestjs/common";
import { AppDataSource } from "@platform/db/src/datasource";

@Controller()
export class HealthController {
  @Get("api/health")
  health() { return { ok: true, service: "hr-api" }; }

  @Get("api/ready")
  async ready(@Req() req: any) {
    try { await AppDataSource.query("select 1"); } catch { return { ok:false, db:false, redis:false, error:"db_failed" }; }
    try { await req.app.locals.redis.ping(); } catch { return { ok:false, db:true, redis:false, error:"redis_failed" }; }
    return { ok:true, db:true, redis:true };
  }
}