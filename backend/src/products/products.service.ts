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

  async findAll(categoryId?: number) {
    const produits = await this.repo.find({
      where: categoryId ? { categoryId } : {},
      order: { name: 'ASC' },
    });
    // Les produits suivent l'ordre des categories, puis l'alphabet : dans
    // l'onglet « Tous », le serveur trouve les boissons chaudes et les petits
    // dejeuners en tete plutot qu'un classement alphabetique qui melange tout.
    //
    // Trie en JS plutot qu'en SQL : la place des valeurs nulles depend du
    // moteur, et un produit sans categorie ne doit pas remonter en premier.
    const rang = (p: Product) => p.category?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const famille = (p: Product) => p.category?.name ?? '';
    return produits.sort((a, b) => {
      if (rang(a) !== rang(b)) return rang(a) - rang(b);
      // Meme rang : on departage comme le fait la liste des categories
      const parFamille = famille(a).localeCompare(famille(b), 'fr');
      if (parFamille !== 0) return parFamille;
      return a.name.localeCompare(b.name, 'fr');
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
