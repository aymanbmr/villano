import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemDto {
  @IsInt()
  productId: number;

  @IsInt()
  @Min(1)
  quantity: number;
}

// Settling an order at the caisse
export class PayOrderDto {
  @IsIn(['cash', 'card'])
  paymentMethod: 'cash' | 'card';

  // Cash received from the customer; ignored for card payments
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amountPaid?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discount?: number;
}

// Adding lines to an order that is still open
export class AddItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

export class CreateOrderDto extends AddItemsDto {
  @IsOptional()
  @IsIn(['dine_in', 'takeaway'])
  orderType?: 'dine_in' | 'takeaway';

  @IsOptional()
  @IsString()
  @MaxLength(20)
  tableNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  // Optional: pay immediately (e.g. takeaway). Omit to leave the order pending.
  @IsOptional()
  @ValidateNested()
  @Type(() => PayOrderDto)
  payment?: PayOrderDto;
}

// Editing the header of an open order
export class UpdateOrderDto {
  @IsOptional()
  @IsIn(['dine_in', 'takeaway'])
  orderType?: 'dine_in' | 'takeaway';

  @IsOptional()
  @IsString()
  @MaxLength(20)
  tableNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string | null;
}

// Changing one line of an open order (0 removes the line)
export class UpdateItemDto {
  @IsInt()
  @Min(0)
  quantity: number;
}
