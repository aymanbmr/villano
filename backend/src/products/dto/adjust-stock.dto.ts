import { IsInt } from 'class-validator';

export class AdjustStockDto {
  // Positive to restock, negative to remove (e.g. spoilage)
  @IsInt()
  delta: number;
}
