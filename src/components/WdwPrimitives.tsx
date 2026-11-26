import React from 'react';
import type { FamilyMember, MemberRole } from '../types/finance';

const ROLE_RING_STYLE: Record<MemberRole, string> = {
  admin:
    'border-2 border-[#064E3B] bg-[#b0f0d6]/60 text-[#002117] dark:border-[#80bea6] dark:bg-[#064E3B]/50 dark:text-[#b0f0d6]',
  partner:
    'border-2 border-[#D97706] bg-[#FEF3C7] text-[#663500] dark:border-[#fe932c] dark:bg-[#904d00]/40 dark:text-[#ffdcc3]',
  dependent:
    'border-2 border-[#0F766E] bg-[#9cf2e8]/60 text-[#00201d] dark:border-[#6ac0b6] dark:bg-[#004d47]/50 dark:text-[#9cf2e8]',
  advisor:
    'border-2 border-[#004d47] bg-[#eaedff] text-[#003430] dark:border-[#80d5cb] dark:bg-[#1c2640] dark:text-[#9cf2e8]',
  shared:
    'border-2 border-[#707974] bg-[#f2f3ff] text-[#131b2e] dark:border-[#bfc9c3] dark:bg-[#283044] dark:text-[#eef0ff]',
};

/**
 * Circular avatar bordered with Warm Domestic Wealth role-ring colors:
 * Elder/Head (#064E3B), Primary Earner/Partner (#D97706), Dependent/Youth (#0F766E).
 */
export const MemberRoleAvatar: React.FC<{
  avatar?: string;
  role?: MemberRole;
  name?: string;
  size?: 'xs' | 'sm' | 'md';
  onDark?: boolean;
}> = ({ avatar = '👤', role = 'admin', name, size = 'sm', onDark = false }) => {
  const dims =
    size === 'xs'
      ? 'h-6 w-6 text-xs'
      : size === 'md'
      ? 'h-10 w-10 text-lg'
      : 'h-8 w-8 text-sm';

  const ringClass = onDark
    ? role === 'partner'
      ? 'border-2 border-[#fe932c] bg-[#283044] text-white'
      : role === 'dependent'
      ? 'border-2 border-[#6ac0b6] bg-[#004d47] text-white'
      : 'border-2 border-[#b0f0d6] bg-[#003527] text-white'
    : ROLE_RING_STYLE[role] ?? ROLE_RING_STYLE.admin;

  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full shadow-2xs ${dims} ${ringClass}`}
    >
      <span aria-hidden="true">{avatar}</span>
    </span>
  );
};

/**
 * Overlapping micro-avatar stack for the top-right corner of Household Net Worth Vault cards.
 */
export const HouseholdAvatarStack: React.FC<{
  members: FamilyMember[];
  max?: number;
  onDark?: boolean;
}> = ({ members, max = 4, onDark = true }) => {
  const visible = members.filter((m) => m.role !== 'shared').slice(0, max);
  if (visible.length === 0) return null;

  return (
    <div className="flex items-center -space-x-2" aria-hidden="true">
      {visible.map((m) => (
        <div
          key={m.id}
          className="rounded-full ring-2 ring-[#064E3B] transition-transform hover:z-10 hover:scale-105"
        >
          <MemberRoleAvatar
            avatar={m.avatar}
            role={m.role}
            name={m.name}
            size="sm"
            onDark={onDark}
          />
        </div>
      ))}
    </div>
  );
};

/**
 * Bilingual pill combining Latin + Gujarati with optical script weight balance.
 */
export const BilingualChip: React.FC<{
  latin: string;
  gujarati?: string;
  tone?: 'spruce' | 'amber' | 'teal';
  className?: string;
}> = ({ latin, gujarati, tone = 'spruce', className = '' }) => {
  const toneClasses =
    tone === 'amber'
      ? 'bg-[#D97706]/10 text-[#904d00] ring-1 ring-[#D97706]/20 dark:bg-[#fe932c]/15 dark:text-[#ffdcc3]'
      : tone === 'teal'
      ? 'bg-[#0F766E]/10 text-[#003430] ring-1 ring-[#0F766E]/20 dark:bg-[#6ac0b6]/15 dark:text-[#9cf2e8]'
      : 'bg-[#064E3B]/8 text-[#064E3B] ring-1 ring-[#064E3B]/15 dark:bg-[#80bea6]/15 dark:text-[#b0f0d6]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] leading-[18px] ${toneClasses} ${className}`}
    >
      <span className="font-medium tracking-[0.02em]">{latin}</span>
      {gujarati && (
        <>
          <span className="opacity-45" aria-hidden="true">
            ·
          </span>
          <span className="font-normal">{gujarati}</span>
        </>
      )}
    </span>
  );
};
