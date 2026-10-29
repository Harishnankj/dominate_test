export interface TTLockItem {
  lockId: number | string;
  lockName: string;
  lockAlias?: string;
  lockMac?: string;
  electricQuantity?: number;
  hasGateway?: number;
}

export class TTLockService {
  private static BASE_URL = 'https://euapi.ttlock.com';

  static async authenticate(
    clientId: string,
    clientSecret: string,
    username: string,
    passwordMd5: string
  ): Promise<{ accessToken: string; expiresIn: number; openid: number }> {
    const params = new URLSearchParams({
      clientId,
      clientSecret,
      username,
      password: passwordMd5,
      grant_type: 'password',
    });

    const res = await fetch(`${this.BASE_URL}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      throw new Error(`TTLock auth failed (${res.status}): ${res.statusText}`);
    }

    const data = (await res.json()) as any;
    if (data.errcode && data.errcode !== 0) {
      throw new Error(`TTLock error: ${data.errmsg || data.errcode}`);
    }

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      openid: data.openid,
    };
  }

  static async fetchLocks(clientId: string, accessToken: string): Promise<TTLockItem[]> {
    const url = new URL(`${this.BASE_URL}/v3/lock/list`);
    url.searchParams.set('clientId', clientId);
    url.searchParams.set('accessToken', accessToken);
    url.searchParams.set('pageNo', '1');
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('date', Date.now().toString());

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Failed to fetch TTLock list (${res.status})`);
    }

    const data = (await res.json()) as any;
    if (data.errcode && data.errcode !== 0) {
      throw new Error(`TTLock list error: ${data.errmsg || data.errcode}`);
    }

    const list = data.list || [];
    return list.map((item: any) => ({
      lockId: item.lockId,
      lockName: item.lockName || item.lockAlias || `Lock ${item.lockId}`,
      lockAlias: item.lockAlias || item.lockName,
      lockMac: item.lockMac,
      electricQuantity: item.electricQuantity ?? 100,
      hasGateway: item.hasGateway ?? 1,
    }));
  }

  static async unlock(
    clientId: string,
    accessToken: string,
    lockId: string | number,
    legacyUrl?: string
  ): Promise<{ ok: boolean; message: string }> {
    // If user provided a custom legacy unlock URL
    if (legacyUrl) {
      const formatted = legacyUrl.replace('{lockId}', String(lockId));
      const res = await fetch(formatted, { method: 'POST' });
      return { ok: res.ok, message: res.ok ? 'Unlocked via legacy gateway' : 'Failed via legacy gateway' };
    }

    // Default to TTLock Cloud Gateway unlock endpoint
    const url = `${this.BASE_URL}/v3/lock/unlock`;
    const params = new URLSearchParams({
      clientId,
      accessToken,
      lockId: String(lockId),
      date: Date.now().toString(),
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = (await res.json()) as any;
    if (data.errcode && data.errcode !== 0) {
      return { ok: false, message: data.errmsg || `Error code ${data.errcode}` };
    }

    return { ok: true, message: 'Unlock signal sent successfully' };
  }
}
