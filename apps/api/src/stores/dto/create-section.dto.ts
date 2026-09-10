/**
 * ZYRA — Create Section DTO
 * Standalone DTO for creating a new page section.
 */

import { IsString, IsObject, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSectionDto {
  @IsString()
  type: string;

  @IsObject()
  content: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;
}
