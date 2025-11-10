declare module "luxon" {
  type DurationLike = {
    years?: number;
    months?: number;
    days?: number;
    hours?: number;
    minutes?: number;
  };

  type Duration = {
    years?: number;
    months?: number;
    days: number;
    hours: number;
    minutes: number;
    as(unit: string): number;
  };

  type DateTimeOptions = {
    zone?: string;
  };

  export class DateTime {
    static now(): DateTime;
    static fromISO(isoString: string, options?: DateTimeOptions): DateTime;
    setZone(zone: string): DateTime;
    plus(values: DurationLike): DateTime;
    minus(values: DurationLike): DateTime;
    set(values: { hour?: number; minute?: number }): DateTime;
    startOf(unit: "hour" | "day"): DateTime;
    toISO(): string;
    toUTC(): DateTime;
    diffNow(unit?: string | string[]): Duration;
    get hour(): number;
    get minute(): number;
    get isValid(): boolean;
  }
}
