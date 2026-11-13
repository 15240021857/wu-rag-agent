import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('WU RAG 业务接口')
    .setDescription(
      '响应体统一为 { code, message, data }，成功时 code 为 0。除登录、退出和健康检查外，请求头需要 Authorization: Bearer <token>。',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  document.security = [{ bearer: [] }];
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
  });
}
