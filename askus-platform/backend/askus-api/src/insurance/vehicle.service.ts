import { BadGatewayException, Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const FUELS: Record<string, string> = { PETROL: 'Petrol', DIESEL: 'Diesel', CNG: 'CNG', LPG: 'LPG', ELECTRIC: 'Electric', EV: 'Electric', BATTERY: 'Electric' };
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Maps a provider's RC record onto our form fields (written for Surepass `rc-full`).
function mapRecord(d: Record<string, unknown>) {
  const fuelRaw = str(d.fuel_type).toUpperCase();
  const fuel = Object.entries(FUELS).find(([k]) => fuelRaw.includes(k))?.[1] ?? '';
  const reg = str(d.registration_date).slice(0, 10);
  const mfg = str(d.manufacturing_date_formatted) || str(d.manufacturing_date);
  const mm = mfg.match(/^(\d{4})-(\d{2})/) ?? mfg.match(/^(\d{1,2})[/-](\d{4})/);
  const manufactureMonth = !mm ? '' : mm[1].length === 4 ? `${mm[1]}-${mm[2]}` : `${mm[2]}-${mm[1].padStart(2, '0')}`;
  const expiry = str(d.insurance_upto).slice(0, 10);
  return {
    makeModel: [str(d.maker_description), str(d.maker_model)].filter(Boolean).join(' '),
    variant: '',
    fuel,
    registrationDate: ISO_DATE.test(reg) ? reg : '',
    manufactureMonth,
    prevInsurer: str(d.insurance_company),
    prevExpiry: ISO_DATE.test(expiry) ? expiry : '',
  };
}

@Injectable()
export class VehicleService {
  constructor(private readonly config: ConfigService) {}

  // Owner name and other personal fields are deliberately not returned to the browser.
  async lookup(regNumber: string) {
    const url = this.config.get<string>('VEHICLE_API_URL');
    const key = this.config.get<string>('VEHICLE_API_KEY');
    if (!url || !key) throw new NotImplementedException('Vehicle lookup is not configured.');

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_number: regNumber }),
      });
    } catch {
      throw new BadGatewayException('Vehicle lookup is unavailable right now.');
    }
    if (!res.ok) throw new NotFoundException('No details found for this number.');
    const body = (await res.json()) as { data?: Record<string, unknown> };
    if (!body.data) throw new NotFoundException('No details found for this number.');
    return { vehicle: mapRecord(body.data) };
  }
}
