import type { BilingualEntry } from './dictCore';

export const DICT_RUNTIME = {
  // Toasts & runtime feedback inside FinanceContext & hooks
  'toast.installed': {
    en: 'HearthLedger installed for offline use.',
    gu: 'હાર્થલેજર એપ ઑફલાઇન ઉપયોગ માટે ઇન્સ્ટોલ થઈ ગઈ છે.',
  },
  'toast.switchedProfile': {
    en: 'Switched profile to {avatar} {name} ({role})',
    gu: 'પ્રોફાઇલ બદલાઈ: {avatar} {name} ({role})',
  },
  'toast.syncedRev': {
    en: 'Synced household update (#{rev})',
    gu: 'પરિવાર ડેટા સિંક થયો (#{rev})',
  },
  'toast.mergedConflict': {
    en: 'Merged newer changes from another family device.',
    gu: 'અન્ય પરિવાર ઉપકરણના નવા ફેરફારો સિંક કરવામાં આવ્યા.',
  },
  'toast.migratedIdb': {
    en: 'Migrated household ledger to IndexedDB storage.',
    gu: 'પરિવાર ખાતાવહી IndexedDB સ્ટોરેજમાં સુરક્ષિત ખસેડાઈ.',
  },
  'toast.autoPostedCount': {
    en: 'Auto-posted {count} scheduled {noun} ({titles})',
    gu: '{count} નિયમિત {noun} ઓટો-પોસ્ટ થયા ({titles})',
  },
  'toast.itemSingular': { en: 'item', gu: 'નોંધ' },
  'toast.itemPlural': { en: 'items', gu: 'નોંધો' },
  'toast.syncedFromActor': {
    en: 'Synced update from {actor}',
    gu: '{actor} દ્વારા નવો ફેરફાર સિંક થયો',
  },
  'toast.syncedRemoteRev': {
    en: 'Synced remote update (#{rev})',
    gu: 'રિમોટ અપડેટ સિંક થયો (#{rev})',
  },
  'toast.pinUpdated': {
    en: 'Household PIN updated with salted SHA-256 hash.',
    gu: 'પરિવાર PIN સુરક્ષિત SHA-256 વડે અપડેટ થયો.',
  },
  'toast.pinDisabled': {
    en: 'Household PIN lock disabled.',
    gu: 'પરિવાર PIN લૉક બંધ કરવામાં આવ્યો.',
  },
  'toast.savedTx': {
    en: 'Saved "{merchant}"',
    gu: '"{merchant}" સાચવ્યું',
  },
  'toast.updatedTx': {
    en: 'Transaction updated',
    gu: 'વ્યવહાર અપડેટ થયો',
  },
  'toast.attachedReceipt': {
    en: 'Attached receipt "{fileName}"',
    gu: 'રસીદ "{fileName}" જોડવામાં આવી',
  },
  'toast.removedReceipt': {
    en: 'Removed receipt from "{merchant}"',
    gu: '"{merchant}" માંથી રસીદ દૂર કરી',
  },
  'toast.deletedTxs': {
    en: 'Deleted {count} {noun}',
    gu: '{count} {noun} કાઢી નાખ્યા',
  },
  'toast.txSingular': { en: 'transaction', gu: 'વ્યવહાર' },
  'toast.txPlural': { en: 'transactions', gu: 'વ્યવહારો' },
  'toast.importedTxs': {
    en: 'Imported {count} transactions',
    gu: '{count} વ્યવહારો આયાત થયા',
  },
  'toast.settledPair': {
    en: 'Settled {from} → {to} IOU',
    gu: '{from} → {to} લેણદેણ પતાવટ પૂર્ણ',
  },
  'toast.removedMember': {
    en: 'Removed member {name}',
    gu: 'સભ્ય {name} દૂર કર્યા',
  },
  'toast.deletedAccount': {
    en: 'Deleted account {name}',
    gu: 'ખાતું {name} કાઢી નાખ્યું',
  },
  'toast.deletedCategory': {
    en: 'Deleted category {name}',
    gu: 'શ્રેણી {name} કાઢી નાખી',
  },
  'toast.deletedSchedule': {
    en: 'Deleted schedule "{title}"',
    gu: 'શેડ્યૂલ "{title}" કાઢી નાખ્યું',
  },
  'toast.postedTitle': {
    en: 'Posted "{title}"',
    gu: '"{title}" નોંધાયું',
  },
  'toast.goalContribution': {
    en: 'Goal contribution recorded',
    gu: 'બચત લક્ષ્ય યોગદાન નોંધાયું',
  },
  'toast.deletedGoal': {
    en: 'Deleted goal "{name}"',
    gu: 'લક્ષ્ય "{name}" કાઢી નાખ્યું',
  },
  'toast.debtPayment': {
    en: 'Debt payment recorded',
    gu: 'લોન હપ્તાની ચુકવણી નોંધાઈ',
  },
  'toast.deletedDebt': {
    en: 'Deleted loan "{name}"',
    gu: 'લોન "{name}" કાઢી નાખી',
  },
  'toast.deletedRule': {
    en: 'Deleted rule "{pattern}"',
    gu: 'નિયમ "{pattern}" કાઢી નાખ્યો',
  },
  'toast.updatedRulesCount': {
    en: 'Updated {count} {noun} from rules',
    gu: 'નિયમોથી {count} {noun} અપડેટ થયા',
  },
  'toast.allRulesMatch': {
    en: 'All matching transactions already follow your rules.',
    gu: 'બધા મળતા વ્યવહારો પહેલેથી જ નિયમો મુજબ છે.',
  },
  'toast.noAutoPostDue': {
    en: 'No auto-pay schedules are currently due.',
    gu: 'હાલમાં કોઈ ઓટો-પે શેડ્યૂલ બાકી નથી.',
  },
  'toast.savedPreset': {
    en: 'Saved CSV preset "{name}"',
    gu: 'CSV પ્રીસેટ "{name}" સાચવ્યો',
  },
  'toast.backupRestored': {
    en: 'Backup restored',
    gu: 'બેકઅપ રીસ્ટોર થયો',
  },
  'toast.demoLoaded': {
    en: 'Loaded demo household data',
    gu: 'ડેમો પરિવાર ડેટા લોડ થયો',
  },
  'toast.clearedData': {
    en: 'Cleared ledger data',
    gu: 'ખાતાવહીનો બધો ડેટા સાફ થયો',
  },

  // Audit feed entries generated on client/server
  'audit.syncDefault': {
    en: '{name} synced household state',
    gu: '{name} એ પરિવારનો ડેટા સિંક કર્યો',
  },
  'audit.initSync': {
    en: '{name} initialized household sync',
    gu: '{name} એ પરિવાર સિંક શરૂ કર્યું',
  },
  'audit.pinUpdated': {
    en: 'Updated household PIN protection',
    gu: 'પરિવાર PIN સુરક્ષા અપડેટ કરી',
  },
  'audit.pinDisabled': {
    en: 'Disabled household PIN lock',
    gu: 'પરિવાર PIN લૉક બંધ કર્યો',
  },
  'audit.addTx': {
    en: 'Added {txType} "{merchant}" ({amount} {currency})',
    gu: '{txType} "{merchant}" ({amount} {currency}) ઉમેર્યું',
  },
  'audit.editTx': {
    en: 'Updated transaction "{name}"',
    gu: 'વ્યવહાર "{name}" અપડેટ કર્યો',
  },
  'audit.attachReceipt': {
    en: 'Attached receipt "{fileName}" to "{merchant}"',
    gu: '"{merchant}" પર રસીદ "{fileName}" જોડી',
  },
  'audit.removeReceipt': {
    en: 'Removed receipt from "{merchant}"',
    gu: '"{merchant}" માંથી રસીદ દૂર કરી',
  },
  'audit.deleteTxs': {
    en: 'Deleted {count} {noun}',
    gu: '{count} {noun} કાઢી નાખ્યા',
  },
  'audit.importCsv': {
    en: 'Imported {count} transactions via CSV',
    gu: 'CSV દ્વારા {count} વ્યવહારો આયાત કર્યા',
  },
  'audit.toggleSplit': {
    en: 'Toggled split settlement for {member} on "{merchant}"',
    gu: '"{merchant}" પર {member} નો બિલ ભાગ પતાવટ સ્થિતિ બદલી',
  },
  'audit.settlePair': {
    en: 'Settled {from} → {to} IOU ({amount})',
    gu: '{from} → {to} લેણદેણ ({amount}) પતાવટ કરી',
  },
  'audit.iouMerchant': {
    en: 'IOU Settlement: {from} → {to}',
    gu: 'લેણદેણ પતાવટ: {from} → {to}',
  },
  'audit.iouNote': {
    en: 'Settled shared family split balance',
    gu: 'સંયુક્ત પરિવાર બિલ ભાગલાની પતાવટ',
  },
  'audit.upsertMember': {
    en: 'Updated family profile "{name}"',
    gu: 'પરિવાર પ્રોફાઇલ "{name}" અપડેટ કરી',
  },
  'audit.removeMember': {
    en: 'Removed member "{name}"',
    gu: 'સભ્ય "{name}" દૂર કર્યા',
  },
  'audit.saveAccount': {
    en: 'Saved account "{name}"',
    gu: 'ખાતું "{name}" સાચવ્યું',
  },
  'audit.saveCategory': {
    en: 'Updated budget category "{name}"',
    gu: 'બજેટ શ્રેણી "{name}" અપડેટ કરી',
  },
  'audit.saveRecurring': {
    en: 'Updated recurring schedule "{title}"',
    gu: 'નિયમિત શેડ્યૂલ "{title}" અપડેટ કર્યું',
  },
  'audit.postRecurring': {
    en: 'Posted recurring "{title}"',
    gu: 'નિયમિત નોંધ "{title}" પોસ્ટ કરી',
  },
  'audit.saveGoal': {
    en: 'Saved goal "{name}"',
    gu: 'બચત લક્ષ્ય "{name}" સાચવ્યું',
  },
  'audit.contribGoal': {
    en: 'Contributed {amount} toward "{name}"',
    gu: '"{name}" માં {amount} જમા કર્યા',
  },
  'audit.debtPayment': {
    en: 'Recorded {amount} debt payment on "{name}"',
    gu: '"{name}" પર {amount} લોન હપ્તો નોંધ્યો',
  },
  'audit.saveRule': {
    en: 'Saved merchant rule "{pattern}"',
    gu: 'દુકાનદાર નિયમ "{pattern}" સાચવ્યો',
  },
  'audit.applyRules': {
    en: 'Applied merchant rules to {count} transactions',
    gu: '{count} વ્યવહારો પર નિયમો લાગુ કર્યા',
  },
  'audit.autoPost': {
    en: 'Auto-posted {count} scheduled items',
    gu: '{count} નિયમિત નોંધ ઓટો-પોસ્ટ કરી',
  },
  'audit.restoreBackup': {
    en: 'Restored household backup',
    gu: 'પરિવાર બેકઅપ રીસ્ટોર કર્યો',
  },
  'toast.updatedStatus': {
    en: 'Marked "{merchant}" as {status}',
    gu: '"{merchant}" ને {status} તરીકે નોંધ્યું',
  },
  'toast.bulkCleared': {
    en: 'Marked {count} transactions as cleared',
    gu: '{count} વ્યવહારો ક્લિયર્ડ તરીકે નોંધાયા',
  },
  'toast.deletedPreset': {
    en: 'Deleted CSV preset "{name}"',
    gu: 'CSV પ્રીસેટ "{name}" કાઢી નાખ્યો',
  },
  'toast.reconciledAccount': {
    en: 'Reconciled "{account}" with {diff} adjustment',
    gu: '"{account}" નો હિસાબ {diff} સમાયોજન સાથે મેળવ્યો',
  },
  'audit.reconcileAccount': {
    en: 'Posted reconciliation adjustment ({amount}) on "{account}"',
    gu: '"{account}" પર હિસાબ મેળવણી સમાયોજન ({amount}) નોંધ્યું',
  },
  'acc.reconcileAdjMerchant': {
    en: 'Statement Reconciliation Adjustment',
    gu: 'બેંક સ્ટેટમેન્ટ હિસાબ સમાયોજન',
  },
  'acc.reconcileAdjNote': {
    en: 'Auto-created to match closing statement balance',
    gu: 'બેંક સ્ટેટમેન્ટ મુજબ અંતિમ બેલેન્સ મેળવવા માટે નોંધ',
  },
  'toast.investedSip': {
    en: 'Recorded SIP installment for "{name}"',
    gu: '"{name}" નો SIP હપ્તો નોંધાયો',
  },
  'toast.deletedInvestment': {
    en: 'Removed holding "{name}"',
    gu: 'રોકાણ "{name}" દૂર કર્યું',
  },
  'toast.deletedSip': {
    en: 'Deleted SIP plan "{name}"',
    gu: 'SIP યોજના "{name}" કાઢી નાખી',
  },
  'audit.saveInvestment': {
    en: 'Saved investment "{symbol}"',
    gu: 'રોકાણ "{symbol}" સાચવ્યું',
  },
  'audit.recordSip': {
    en: 'Invested {amount} into SIP "{name}"',
    gu: 'SIP "{name}" માં {amount} રોકાણ કર્યું',
  },
  'toast.signedInAs': {
    en: 'Signed in as {name}',
    gu: '{name} તરીકે લૉગ ઇન થયા',
  },
  'toast.accountCreated': {
    en: 'Welcome, {name}! Account created.',
    gu: 'સ્વાગત છે, {name}! ખાતું તૈયાર છે.',
  },
  'toast.planUpdated': {
    en: 'Switched subscription to {tier} tier',
    gu: 'પ્લાન અપડેટ થયો: {tier}',
  },
  'audit.upgradePlan': {
    en: 'Updated household plan to {tier}',
    gu: 'પરિવાર પ્લાન બદલીને {tier} કર્યો',
  },
  'audit.savePolicy': {
    en: 'Saved insurance policy "{name}"',
    gu: 'વીમા પૉલિસી "{name}" સાચવી',
  },
  'toast.deletedPolicy': {
    en: 'Removed policy "{name}"',
    gu: 'વીમા પૉલિસી "{name}" દૂર કરી',
  },
  'audit.updateEmergency': {
    en: 'Updated Emergency & Nominee Pack',
    gu: 'કટોકટી અને નોમિની માહિતી અપડેટ કરી',
  },
  'toast.savedEmergency': {
    en: 'Emergency & Nominee Pack saved',
    gu: 'કટોકટી અને નોમિની માર્ગદર્શિકા સાચવી',
  },
} satisfies Record<string, BilingualEntry>;

export type RuntimeDictKey = keyof typeof DICT_RUNTIME;
