import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KBArticle, KBCategory } from './solutions.entities';

const slugify = (title: string) =>
  title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

@Injectable()
export class KbService {
  constructor(@InjectRepository(KBArticle) private readonly articles: Repository<KBArticle>) {}

  findPublished(category?: string, search?: string) {
    const qb = this.articles.createQueryBuilder('a').where('a.published = true');
    if (category) qb.andWhere('a.category = :category', { category });
    if (search) qb.andWhere('(a.title ILIKE :s OR a.body ILIKE :s)', { s: `%${search}%` });
    return qb.orderBy('a.createdAt', 'DESC').getMany();
  }

  findAllAdmin() {
    return this.articles.find({ order: { createdAt: 'DESC' } });
  }

  async findBySlug(slug: string) {
    const article = await this.articles.findOne({ where: { slug, published: true } });
    if (!article) throw new NotFoundException('Not found');
    return article;
  }

  async create(body: { title: string; category?: KBCategory; body: string; published?: boolean }) {
    if (!body.title || !body.body) throw new BadRequestException('Title and body are required');
    let slug = slugify(body.title);
    if (await this.articles.findOne({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
    return this.articles.save(
      this.articles.create({
        title: body.title,
        slug,
        category: body.category ?? 'General',
        body: body.body,
        published: body.published ?? true,
      }),
    );
  }

  async update(id: string, body: Partial<{ title: string; category: KBCategory; body: string; published: boolean }>) {
    const article = await this.articles.findOne({ where: { id } });
    if (!article) throw new NotFoundException('Not found');
    if (body.title) article.title = body.title;
    if (body.category) article.category = body.category;
    if (body.body) article.body = body.body;
    if (body.published !== undefined) article.published = body.published;
    return this.articles.save(article);
  }

  async remove(id: string) {
    await this.articles.delete({ id });
    return { message: 'Article deleted' };
  }
}
