import { NextRequest, NextResponse } from 'next/server';
import { verifyERPAuth } from '@/lib/erp';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyERPAuth(request);

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      userId: auth.userId,
      permissions: auth.permissions,
      hasERPAccess: auth.hasERPAccess,
      roles: auth.erpRoles,
      isAdmin: auth.isAdmin,
    });
  } catch (error) {
    console.error('ERP permissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
