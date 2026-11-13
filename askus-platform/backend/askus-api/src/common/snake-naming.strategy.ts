import { DefaultNamingStrategy } from 'typeorm';

const toSnake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

// Explicit column names win; everything else becomes snake_case like the other schemas.
export class SnakeNamingStrategy extends DefaultNamingStrategy {
  columnName(propertyName: string, customName: string, embeddedPrefixes: string[]): string {
    return customName ? customName : toSnake([...embeddedPrefixes, propertyName].join('_'));
  }
}
