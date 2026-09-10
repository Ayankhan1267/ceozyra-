/**
 * ZYRA — Auth Guard
 */

import { Injectable } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { TENANT_CONTEXT } from '../tenant/tenant.context';

@Injectable()
export class AuthGuard extends PassportAuthGuard('jwt') {
  async canActivate(context: any): Promise<boolean> {
    const result = (await super.canActivate(context)) as boolean;
    if (result) {
      const req = context.switchToHttp().getRequest();
      await new Promise<void>((resolve) => {
        TENANT_CONTEXT.run(
          {
            tenantId: req.tenant?.id ?? req.user?.tenantId ?? null,
            userId: req.user?.sub ?? null,
          },
          () => resolve(),
        );
      });
    }
    return result;
  }
}
