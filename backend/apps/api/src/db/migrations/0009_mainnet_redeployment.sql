-- Move projects on the superseded Zeno deployment to README@d3d51b5's factory.
-- Keep project IDs, keys, users, sessions and historical operations intact.
-- Other chains and custom factories are deliberately outside this migration.
update projects
set factory_address = '0x494ecbd1d8df35fb39ad5973ec0a1598adf26ea9'
where chain_id = 4663
  and factory_address = '0xd00abbc1d1555a173c5081b2204579b057b05378';
