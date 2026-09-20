import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
  ) {}

  findAll(categoryId?: number) {
    return this.repo.find({
      where: categoryId ? { categoryId } : {},
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number) {
    const product = await this.repo.findOneBy({ id });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  create(dto: CreateProductDto) {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: number, dto: UpdateProductDto) {
    const product = await this.findOne(id);
    Object.assign(product, dto);
    return this.repo.save(product);
  }

  async setImage(id: number, imageUrl: string) {
    const product = await this.findOne(id);
    product.imageUrl = imageUrl;
    return this.repo.save(product);
  }

  async adjustStock(id: number, delta: number) {
    const product = await this.findOne(id);
    const next = product.stock + delta;
    if (next < 0) {
      throw new BadRequestException(
        `Stock cannot go below 0 (current: ${product.stock})`,
      );
    }
    product.stock = next;
    return this.repo.save(product);
  }

  async remove(id: number) {
    const product = await this.findOne(id);
    await this.repo.remove(product);
    return { deleted: true };
  }
}
