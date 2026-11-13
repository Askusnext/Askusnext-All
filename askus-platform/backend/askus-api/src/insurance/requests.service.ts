import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/access';
import { Role } from '../common/roles';
import { User } from '../identity/identity.entities';
import { StorageService } from '../storage/storage.service';
import { DocRef, InsuranceRequest, RequestStatus } from './insurance.entities';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const CASHBACK = { car: 500, bike: 300 } as const;
const MOBILE = /^[6-9]\d{9}$/;
const MIME: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const KEY = /^insurance\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/doc_\d\.(pdf|jpg|png|webp)$/i;

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const nationalMobile = (v: string) => v.replace(/[\s-]/g, '').replace(/^(\+91|0)(?=\d{10}$)/, '');

function pickStrings(src: Record<string, unknown>, keys: string[]) {
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = str(src?.[k]);
  return out;
}

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(InsuranceRequest) private readonly requests: Repository<InsuranceRequest>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  toDto(r: InsuranceRequest) {
    return {
      id: r.id,
      kind: r.kind,
      uid: r.customerId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      status: r.status,
      adminNote: r.adminNote ?? undefined,
      updatedBy: r.updatedBy ?? undefined,
      vehicleType: r.vehicleType ?? undefined,
      cashbackUpTo: r.cashbackUpTo ?? undefined,
      applicant: r.applicant ?? undefined,
      vehicle: r.vehicle ?? undefined,
      policy: r.policy ?? undefined,
      plan: r.plan ?? undefined,
      name: r.contactName ?? undefined,
      mobile: r.contactMobile ?? undefined,
      type: r.docType ?? undefined,
      documents: r.documents ?? [],
    };
  }

  private async requireVerifiedMobile(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user?.mobile) throw new ForbiddenException('Verify your mobile number before continuing.');
    return user;
  }

  // Only keys under this user's own prefix for this request are accepted.
  private cleanDocs(docs: DocRef[], userId: string, requestId: string): DocRef[] {
    const prefix = `insurance/${userId}/${requestId}/`;
    return docs.map((d) => {
      if (!KEY.test(d.key) || !d.key.startsWith(prefix)) throw new BadRequestException('A document reference is invalid.');
      return {
        name: str(d.name, 160), size: d.size, mimeType: str(d.mimeType, 100), key: d.key, format: str(d.format, 10),
        ...(d.kind === 'rc' || d.kind === 'policy' ? { kind: d.kind } : {}),
      };
    });
  }

  async createOffline(user: AuthUser, body: {
    id: string; vehicleType: 'car' | 'bike'; applicant: Record<string, unknown>; vehicle: Record<string, unknown>;
    policy: Record<string, unknown>; plan: Record<string, unknown>; documents: DocRef[];
  }) {
    await this.requireVerifiedMobile(user.id);
    if (await this.requests.exist({ where: { id: body.id } })) throw new BadRequestException('This request was already submitted.');

    const applicant = pickStrings(body.applicant, ['name', 'gender', 'mobile', 'email', 'address', 'city', 'pincode', 'onLoan', 'addressSource']);
    applicant.mobile = nationalMobile(applicant.mobile);
    if (applicant.name.length < 2 || applicant.name.length > 80) throw new BadRequestException('Enter the applicant name.');
    if (!MOBILE.test(applicant.mobile)) throw new BadRequestException('Enter a valid 10-digit mobile number.');
    if (!/^\d{6}$/.test(applicant.pincode)) throw new BadRequestException('Enter a valid 6-digit pincode.');

    const vehicleSrc = body.vehicle ?? {};
    const vehicle: Record<string, string | boolean> = {
      ...pickStrings(vehicleSrc, ['regNumber', 'makeModel', 'variant', 'fuel', 'registrationDate', 'manufactureMonth']),
      isNew: vehicleSrc.isNew === true,
    };
    const policy = pickStrings(body.policy ?? {}, ['policyType', 'expiredOver90', 'prevPolicyType', 'prevInsurer', 'prevExpiry', 'claimMade', 'ncb', 'ownerType', 'ownershipChanged']);
    const planSrc = body.plan ?? {};
    const list = (v: unknown) => (Array.isArray(v) ? v.slice(0, 30).map((x) => str(x, 80)).filter(Boolean) : []);
    const plan = {
      insurers: list(planSrc.insurers), addons: list(planSrc.addons), ayushPay: planSrc.ayushPay === true,
      ...pickStrings(planSrc, ['preferredIdv', 'idvMode', 'exShowroom', 'accessoriesValue']),
    };

    const saved = await this.requests.save(
      this.requests.create({
        id: body.id,
        customerId: user.id,
        kind: 'offline',
        status: 'new',
        vehicleType: body.vehicleType,
        cashbackUpTo: CASHBACK[body.vehicleType],
        applicant, vehicle, policy, plan,
        documents: this.cleanDocs(body.documents, user.id, body.id),
      }),
    );
    return { id: saved.id };
  }

  async createDocuments(user: AuthUser, body: { id: string; name: string; mobile: string; type: string; documents: DocRef[] }) {
    await this.requireVerifiedMobile(user.id);
    if (await this.requests.exist({ where: { id: body.id } })) throw new BadRequestException('This request was already submitted.');
    const mobile = nationalMobile(body.mobile);
    if (!MOBILE.test(mobile)) throw new BadRequestException('Enter a valid 10-digit mobile number.');
    const saved = await this.requests.save(
      this.requests.create({
        id: body.id,
        customerId: user.id,
        kind: 'upload',
        status: 'new',
        contactName: str(body.name, 80),
        contactMobile: mobile,
        docType: str(body.type, 80),
        documents: this.cleanDocs(body.documents, user.id, body.id),
      }),
    );
    return { id: saved.id };
  }

  async listMine(userId: string) {
    const rows = await this.requests.find({ where: { customerId: userId }, order: { createdAt: 'DESC' }, take: 200 });
    return rows.map((r) => this.toDto(r));
  }

  async listAll() {
    const rows = await this.requests.find({ order: { createdAt: 'DESC' }, take: 300 });
    return rows.map((r) => this.toDto(r));
  }

  async review(id: string, patch: { status: RequestStatus; adminNote: string }, staff: AuthUser) {
    const row = await this.requests.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Request not found');
    const from = row.status;
    row.status = patch.status;
    row.adminNote = patch.adminNote.trim() || null;
    row.updatedBy = staff.name;
    await this.requests.save(row);
    await this.audit.log({
      actorId: staff.id, action: 'insurance.update_request', resource: `insurance.requests/${id}`,
      metadata: { from, to: patch.status, note: patch.adminNote.slice(0, 300) },
    });
    return this.toDto(row);
  }

  signUpload(user: AuthUser, body: { requestId: string; index: number; extension: string; size: number }) {
    const ext = body.extension.toLowerCase();
    const contentType = MIME[ext];
    if (!contentType) throw new BadRequestException('Upload a photo or a PDF.');
    if (body.size < 1 || body.size > MAX_UPLOAD_BYTES) throw new BadRequestException('Files must be under 10 MB.');
    const key = `insurance/${user.id}/${body.requestId}/doc_${body.index}.${ext === 'jpeg' ? 'jpg' : ext}`;
    return { key, contentType, url: this.storage.signUpload(key, contentType, body.size) };
  }

  signDownload(user: AuthUser, key: string) {
    if (!KEY.test(key)) throw new BadRequestException('That document reference is not valid.');
    const staff = user.roles.includes(Role.SuperAdmin) || user.roles.includes(Role.InsuranceAdmin);
    if (!staff && key.split('/')[1] !== user.id) throw new ForbiddenException('You cannot open this document.');
    return { url: this.storage.signDownload(key, key.split('/').pop() as string) };
  }
}
