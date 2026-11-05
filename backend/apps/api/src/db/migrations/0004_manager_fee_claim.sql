-- Manager fee claims from the FeeEscrow (zenoindex-evm d3bd438); fee-recipient changes stay valid for existing rows.
alter table operations drop constraint operations_action_check;
alter table operations add constraint operations_action_check check (action in (
  'buy', 'redeem_request', 'redeem_swap', 'redeem_claim', 'redeem_claim_in_kind',
  'manager_genesis', 'manager_deploy', 'manager_rebalance', 'manager_allocations',
  'manager_pause', 'manager_write_off', 'manager_reactivate', 'manager_fee_recipient',
  'manager_fee_claim'
));
