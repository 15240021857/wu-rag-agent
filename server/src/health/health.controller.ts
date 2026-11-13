import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { ApiOkData } from '../common/swagger/api-response.js';
import { Public } from '../modules/auth/decorators/public.decorator.js';

export class HealthView {
  @ApiProperty({ example: 'ok' })
  status!: string;
}

@ApiTags('健康检查')
@Public()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({
    summary: '健康检查',
    operationId: 'healthCheck',
    security: [],
  })
  @ApiOkData(HealthView)
  check() {
    return { status: 'ok' };
  }
}
