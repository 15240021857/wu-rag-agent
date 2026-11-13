import { ValidateBy, type ValidationOptions } from 'class-validator';

export function IsNullableId(
  message = '上级不正确',
  options?: ValidationOptions,
) {
  return ValidateBy(
    {
      name: 'isNullableId',
      validator: {
        validate: (value: unknown) =>
          value === null ||
          (typeof value === 'string' && value.length > 0 && value.length <= 64),
        defaultMessage: () => message,
      },
    },
    options,
  );
}
