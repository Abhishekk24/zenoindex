-- Move projects to the factory that prices assets from Chainlink feeds (zenoindex-evm .env.mainnet, 2026-10-23).
-- Baskets on the older factories stay on-chain but leave the app. Other chains and custom factories are untouched.
update projects
set factory_address = '0x21369835194f59e895636f92359de3c3241997ab'
where chain_id = 4663
  and factory_address in ('0x494ecbd1d8df35fb39ad5973ec0a1598adf26ea9', '0xd00abbc1d1555a173c5081b2204579b057b05378');
