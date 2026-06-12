import {
  ArrayMinSize,
  IsEmail,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsOptional()
  organizationName?: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  currency?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class GoogleAuthDto {
  @IsString()
  @IsNotEmpty()
  credential!: string;
}

export class OnboardingAnswerDto {
  @IsString()
  @IsNotEmpty()
  questionKey!: string;

  @IsString()
  @IsNotEmpty()
  answer!: string;
}

export class CompleteOnboardingDto {
  @IsString()
  @IsOptional()
  organizationName?: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OnboardingAnswerDto)
  answers!: OnboardingAnswerDto[];
}

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsOptional()
  @MinLength(8)
  password?: string;

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsIn(['owner', 'accountant', 'viewer'])
  role!: string;

  @IsOptional()
  @IsDateString()
  accessExpiresAt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class UpdateMemberDto {
  @IsOptional()
  @IsIn(['owner', 'accountant', 'viewer'])
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  accessExpiresAt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  industry!: string;

  @IsString()
  @IsOptional()
  currency?: string;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}

export class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class CompleteInvitationDto extends AcceptInvitationDto {
  @IsString()
  @MinLength(8)
  password!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResendOtpDto {
  @IsEmail()
  email!: string;

  @IsIn(['signup', 'password_reset'])
  purpose!: string;
}

export class VerifyOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsIn(['signup', 'password_reset'])
  @IsOptional()
  purpose?: string;
}

export class ResetPasswordDto extends VerifyOtpDto {
  @IsString()
  @MinLength(8)
  password!: string;
}
