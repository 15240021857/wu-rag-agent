import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';

function envelope(data: Record<string, unknown>) {
  return {
    type: 'object',
    required: ['code', 'message', 'data'],
    properties: {
      code: { type: 'number', example: 0 },
      message: { type: 'string', example: 'ok' },
      data,
    },
  };
}

function errorSchema(code: number, message: string) {
  return {
    type: 'object',
    required: ['code', 'message', 'data'],
    properties: {
      code: { type: 'number', example: code },
      message: { type: 'string', example: message },
      data: { type: 'null', nullable: true, example: null },
    },
  };
}

export function ApiOkData(model: Type, description = '成功') {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      description,
      schema: envelope({ $ref: getSchemaPath(model) }),
    }),
  );
}

export function ApiCreatedData(model: Type, description = '创建成功') {
  return applyDecorators(
    ApiExtraModels(model),
    ApiCreatedResponse({
      description,
      schema: envelope({ $ref: getSchemaPath(model) }),
    }),
  );
}

export function ApiOkList(model: Type, description = '成功') {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      description,
      schema: envelope({
        type: 'array',
        items: { $ref: getSchemaPath(model) },
      }),
    }),
  );
}

export function ApiOkPage(model: Type, description = '成功') {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      description,
      schema: envelope({
        type: 'object',
        required: ['list', 'total', 'pageNum', 'pageSize'],
        properties: {
          list: { type: 'array', items: { $ref: getSchemaPath(model) } },
          total: { type: 'number', example: 1 },
          pageNum: { type: 'number', example: 1 },
          pageSize: { type: 'number', example: 10 },
        },
      }),
    }),
  );
}

export function ApiOkEmpty(description = '成功') {
  return ApiOkResponse({
    description,
    schema: envelope({ type: 'null', nullable: true, example: null }),
  });
}

export function ApiStandardErrors() {
  return applyDecorators(
    ApiBadRequestResponse({
      description: '参数或业务校验失败',
      schema: errorSchema(400, '参数错误'),
    }),
    ApiUnauthorizedResponse({
      description: '未登录或登录已过期',
      schema: errorSchema(401, '未登录'),
    }),
    ApiForbiddenResponse({
      description: '没有操作权限',
      schema: errorSchema(403, '没有操作权限'),
    }),
    ApiNotFoundResponse({
      description: '资源不存在',
      schema: errorSchema(404, '资源不存在'),
    }),
    ApiConflictResponse({
      description: '数据冲突',
      schema: errorSchema(409, '数据已存在'),
    }),
  );
}
