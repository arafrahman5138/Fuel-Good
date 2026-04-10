import { useAuthStore, getDefaultEntitlement, hasActivePremiumAccess } from '../../stores/authStore';
import type { UserEntitlement } from '../../stores/authStore';

// Reset store between tests
beforeEach(() => {
  useAuthStore.setState({
    token: null,
    refreshToken: null,
    user: null,
    isAuthenticated: false,
    isLoading: true,
    isBillingLoading: false,
    hasPremiumAccess: false,
  });
});

describe('getDefaultEntitlement', () => {
  it('returns a none/inactive entitlement', () => {
    const ent = getDefaultEntitlement();
    expect(ent.access_level).toBe('none');
    expect(ent.subscription_state).toBe('inactive');
    expect(ent.requires_paywall).toBe(true);
    expect(ent.will_renew).toBe(false);
  });
});

describe('hasActivePremiumAccess', () => {
  it('returns true for active premium', () => {
    const ent: UserEntitlement = { ...getDefaultEntitlement(), access_level: 'premium', subscription_state: 'active' };
    expect(hasActivePremiumAccess(ent)).toBe(true);
  });

  it('returns true for trialing premium', () => {
    const ent: UserEntitlement = { ...getDefaultEntitlement(), access_level: 'premium', subscription_state: 'trialing' };
    expect(hasActivePremiumAccess(ent)).toBe(true);
  });

  it('returns true for grace_period premium', () => {
    const ent: UserEntitlement = { ...getDefaultEntitlement(), access_level: 'premium', subscription_state: 'grace_period' };
    expect(hasActivePremiumAccess(ent)).toBe(true);
  });

  it('returns false for expired premium', () => {
    const ent: UserEntitlement = { ...getDefaultEntitlement(), access_level: 'premium', subscription_state: 'expired' };
    expect(hasActivePremiumAccess(ent)).toBe(false);
  });

  it('returns false for none access level', () => {
    const ent: UserEntitlement = { ...getDefaultEntitlement(), access_level: 'none', subscription_state: 'active' };
    expect(hasActivePremiumAccess(ent)).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(hasActivePremiumAccess(null)).toBe(false);
    expect(hasActivePremiumAccess(undefined)).toBe(false);
  });
});

describe('authStore actions', () => {
  it('setToken sets token and marks authenticated', () => {
    useAuthStore.getState().setToken('abc123');
    const state = useAuthStore.getState();
    expect(state.token).toBe('abc123');
    expect(state.isAuthenticated).toBe(true);
  });

  it('setTokens sets both tokens', () => {
    useAuthStore.getState().setTokens('access', 'refresh');
    const state = useAuthStore.getState();
    expect(state.token).toBe('access');
    expect(state.refreshToken).toBe('refresh');
    expect(state.isAuthenticated).toBe(true);
  });

  it('setUser normalizes the user profile', () => {
    useAuthStore.getState().setUser({
      id: '1',
      email: 'test@test.com',
      name: 'Test',
      auth_provider: 'email',
    } as any);
    const user = useAuthStore.getState().user;
    expect(user).not.toBeNull();
    expect(user!.dietary_preferences).toEqual([]);
    expect(user!.flavor_preferences).toEqual([]);
    expect(user!.allergies).toEqual([]);
    expect(user!.entitlement).toBeDefined();
    expect(user!.entitlement.access_level).toBe('none');
  });

  it('setEntitlement updates user entitlement and premium access', () => {
    // First set a user
    useAuthStore.getState().setUser({
      id: '1', email: 't@t.com', name: 'T', auth_provider: 'email',
    } as any);
    expect(useAuthStore.getState().hasPremiumAccess).toBe(false);

    // Now grant premium
    useAuthStore.getState().setEntitlement({
      ...getDefaultEntitlement(),
      access_level: 'premium',
      subscription_state: 'active',
      requires_paywall: false,
    });
    expect(useAuthStore.getState().hasPremiumAccess).toBe(true);
    expect(useAuthStore.getState().user!.entitlement.access_level).toBe('premium');
  });

  it('setEntitlement preserves manual_override over downgrade', () => {
    useAuthStore.getState().setUser({
      id: '1', email: 't@t.com', name: 'T', auth_provider: 'email',
      entitlement: {
        ...getDefaultEntitlement(),
        access_level: 'premium',
        subscription_state: 'active',
        store: 'manual_override',
        requires_paywall: false,
      },
    } as any);

    // Try to downgrade via a non-premium entitlement
    useAuthStore.getState().setEntitlement({
      ...getDefaultEntitlement(),
      access_level: 'none',
      subscription_state: 'expired',
    });

    // Should preserve the manual_override
    const ent = useAuthStore.getState().user!.entitlement;
    expect(ent.store).toBe('manual_override');
    expect(ent.access_level).toBe('premium');
  });

  it('addXp increments XP', () => {
    useAuthStore.getState().setUser({
      id: '1', email: 't@t.com', name: 'T', auth_provider: 'email', xp_points: 100,
    } as any);
    useAuthStore.getState().addXp(50);
    expect(useAuthStore.getState().user!.xp_points).toBe(150);
  });

  it('addXp does not go below 0', () => {
    useAuthStore.getState().setUser({
      id: '1', email: 't@t.com', name: 'T', auth_provider: 'email', xp_points: 10,
    } as any);
    useAuthStore.getState().addXp(-100);
    expect(useAuthStore.getState().user!.xp_points).toBe(0);
  });

  it('logout clears all auth state', () => {
    useAuthStore.getState().setTokens('a', 'r');
    useAuthStore.getState().setUser({
      id: '1', email: 't@t.com', name: 'T', auth_provider: 'email',
    } as any);

    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.hasPremiumAccess).toBe(false);
  });

  it('setLoading and setBillingLoading update flags', () => {
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);

    useAuthStore.getState().setBillingLoading(true);
    expect(useAuthStore.getState().isBillingLoading).toBe(true);
  });
});
