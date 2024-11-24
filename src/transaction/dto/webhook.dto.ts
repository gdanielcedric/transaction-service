import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class WebhookDto {
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  status: string;
}