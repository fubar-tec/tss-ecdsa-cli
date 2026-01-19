# TSS ECDSA CLI Integration Test Cases

Based on Kudelski Security Audit Report (Version 1.3, May 19, 2025)

## Critical & High Severity Test Cases

### KS-CHL-F-01: Logical Error of Small Factors Check

- `test_small_factors_check_validates_primes_correctly` - Verify prime validation properly rejects numbers divisible by small primes
- `test_small_factors_check_boolean_logic_fixed` - Ensure failed flag is properly set and checked in primality tests

### KS-CHL-F-02: Insufficient Authentication in Signing Room

- `test_signing_room_requires_cryptographic_authentication` - Verify parties must provide cryptographic proof to join signing room
- `test_signing_room_rejects_invalid_party_credentials` - Ensure unauthorized parties cannot access signing sessions
- `test_party_uuid_validation_prevents_unauthorized_access` - Verify UUID-only authentication is insufficient

### KS-CHL-F-05: Dlog Proof Not Validated Properly

- `test_dlog_proof_rejects_zero_values` - Ensure zero/point-at-infinity values are rejected in dlog proofs
- `test_dlog_proof_validates_all_components` - Verify all proof components (y, u, z) are properly validated
- `test_phase_5a_dlog_vec_validation_enforced` - Ensure dlog proofs are validated after being received

### KS-CHL-F-06: Chain Code Not Validated Properly

- `test_chain_code_not_overridden_by_environment_variable` - Verify chain code from key file takes precedence
- `test_chain_code_rejects_zero_value` - Ensure zero chain code is rejected
- `test_chain_code_provides_sufficient_entropy` - Verify chain code adds proper randomness to HD derivation

### KS-CHL-F-07: Message Hash Assumed Implicitly

- `test_sign_function_enforces_hashed_message_input` - Verify sign function validates message is pre-hashed
- `test_sign_rejects_unhashed_messages` - Ensure raw messages are rejected
- `test_forgery_attack_prevention_with_modulo_q` - Verify signatures prevent message + i*q forgery attacks

## Medium Severity Test Cases

### KS-CHL-F-03: Error Message Contains Sensitive Information

- `test_get_endpoint_error_messages_generic` - Verify error messages don't leak key values
- `test_error_responses_prevent_enumeration` - Ensure errors don't reveal active party numbers/UUIDs

### KS-CHL-F-08: Safe Primes Not Used

- `test_party_keys_generation_uses_safe_primes` - Verify key generation uses safe primes (p where (p-1)/2 is also prime)
- `test_strong_rsa_assumption_holds_with_safe_primes` - Ensure ZK proofs are secure with safe prime moduli

### KS-CHL-F-09: Boundary of System Parameters Not Checked

- `test_threshold_and_parties_parameters_validated` - Verify 1 <= THRESHOLD < PARTIES <= MAX_ALLOWED_PARTIES
- `test_party_number_within_valid_range` - Ensure 1 <= party_num_int <= PARTIES
- `test_threshold_signature_requires_sufficient_parties` - Verify n >= t + 1 for (t,n) threshold

## Low Severity Test Cases

### KS-CHL-F-04: Lack of State Recovery and Session Management

- `test_timeout_handling_in_signing_protocol` - Verify timeout scenarios are handled gracefully
- `test_party_disconnect_during_keygen_handled` - Ensure disconnection doesn't leave invalid state
- `test_signing_session_cannot_be_resumed_after_timeout` - Verify sessions don't persist incorrectly

### KS-CHL-F-10: Error Handling with unwrap and expect

- `test_error_handling_no_panics_on_invalid_input` - Verify functions return errors instead of panicking
- `test_graceful_error_handling_throughout_protocol` - Ensure all error paths are handled gracefully

### KS-CHL-F-11: Lack of Input Validation

- `test_keygen_validates_input_parameters` - Verify key generation validates all input params
- `test_hd_key_derivation_validates_inputs` - Ensure HD derivation checks input validity
- `test_signing_function_validates_all_inputs` - Verify signing validates parameters before protocol execution

### KS-CHL-F-12: Total Parties Not Validated

- `test_signup_validates_total_parties_exceeds_threshold` - Ensure total_parties > threshold in signup
- `test_threshold_signature_validates_party_count` - Verify (t,n) signature checks total_parties >= threshold + 1

### KS-CHL-F-13: Party Number Not Validated in SigningRoom

- `test_add_party_validates_party_number_range` - Verify party number is within valid room size
- `test_add_party_prevents_unsafe_integer_conversion` - Ensure no integer overflow in party number handling

### KS-CHL-F-14: Party Index Not Counted Accurately

- `test_total_parties_used_instead_of_threshold_plus_one` - Verify total_parties count is accurate
- `test_party_index_counting_consistent_across_protocol` - Ensure party indices are tracked correctly

### KS-CHL-F-15: Parsed Key Data Not Validated

- `test_key_file_data_validated_after_loading` - Verify loaded key data integrity checks
- `test_invalid_key_data_rejected_on_load` - Ensure corrupted key files are rejected
- `test_key_data_components_within_valid_ranges` - Verify all key components are mathematically valid

### KS-CHL-F-16: Unsafe HashMap Access

- `test_hashmap_access_uses_safe_methods` - Verify HashMap access doesn't use unwrap() unsafely
- `test_party_existence_validated_before_hashmap_access` - Ensure party exists before accessing HashMap
- `test_hashmap_operations_handle_missing_keys_gracefully` - Verify missing keys don't cause panics

### KS-CHL-F-17: HD Child Key Derivation Not BIP32 Compliant

- `test_hd_key_derivation_follows_bip32_standard` - Verify HD derivation matches BIP32 specification
- `test_eddsa_key_clamping_applied_in_hd_derivation` - Ensure Ed25519 keys are properly clamped
- `test_hd_derivation_produces_deterministic_results` - Verify same inputs produce same child keys

### KS-CHL-F-18: HD Child Private Key Not Used For EdDSA Signing

- `test_eddsa_signing_uses_derived_child_private_key` - Verify child private key is actually used in signing
- `test_eddsa_hd_derivation_updates_private_key_state` - Ensure private key is updated, not just public key
- `test_f_l_new_properly_incorporated_into_eddsa_signing` - Verify f_l_new is used correctly

### KS-CHL-F-19: EdDSA Key Clamp Not Applied Properly

- `test_eddsa_private_key_clamping_applied` - Verify private key/scalar is clamped per RFC 8032
- `test_eddsa_public_key_not_clamped` - Ensure public key is not incorrectly clamped
- `test_key_clamping_sets_correct_bits` - Verify highest bit set, second-highest cleared, lowest 3 cleared

### KS-CHL-F-20: Input Parameter of check_sig Not Validated

- `test_check_sig_validates_message_length` - Verify message is exactly 32 bytes
- `test_check_sig_prevents_zero_message_forgery` - Ensure msg=0 with (r,s)=(a,a) attack is prevented
- `test_check_sig_validates_signature_components` - Verify r and s are in valid ranges
- `test_check_sig_rejects_invalid_public_keys` - Ensure invalid public keys are rejected

### KS-CHL-F-21: AES256 Key Length Not Checked

- `test_aes_encrypt_validates_key_length_32_bytes` - Verify AES256 key is exactly 32 bytes
- `test_aes_encrypt_rejects_null_key` - Ensure null/empty keys are rejected
- `test_enc_keys_vector_validated_for_length` - Verify enc_keys vector is proper length

### KS-CHL-F-22: Lack of Test Vectors

- `test_ecdsa_keygen_against_known_test_vectors` - Verify keygen matches known good outputs
- `test_ecdsa_signing_against_known_test_vectors` - Verify signing matches expected results
- `test_eddsa_keygen_against_known_test_vectors` - Verify EdDSA keygen correctness
- `test_eddsa_signing_against_known_test_vectors` - Verify EdDSA signing correctness
- `test_hd_derivation_against_bip32_test_vectors` - Verify HD derivation matches BIP32 test vectors

## Protocol-Level Integration Test Cases

### ECDSA Multi-Party Protocol

- `test_ecdsa_keygen_completes_successfully_with_valid_parties` - Full ECDSA keygen with t+1 parties
- `test_ecdsa_keygen_fails_with_insufficient_parties` - Verify keygen fails when parties < threshold+1
- `test_ecdsa_signing_completes_with_threshold_parties` - Complete signing with exactly threshold+1 parties
- `test_ecdsa_signing_fails_with_insufficient_parties` - Verify signing fails without enough parties
- `test_ecdsa_signature_verification_succeeds` - Verify produced signatures are valid
- `test_ecdsa_multiple_signing_rounds_with_same_key` - Ensure key can be reused for multiple signatures

### EdDSA Multi-Party Protocol

- `test_eddsa_keygen_completes_successfully` - Full EdDSA key generation
- `test_eddsa_signing_produces_valid_signature` - Complete EdDSA signing process
- `test_eddsa_signature_verification_succeeds` - Verify produced EdDSA signatures are valid
- `test_eddsa_multiple_signing_rounds_with_same_key` - Ensure EdDSA key reusability

### State and Session Management

- `test_signing_room_signup_process_completes` - Verify complete signup flow
- `test_signing_room_prevents_duplicate_party_numbers` - Ensure no duplicate party numbers
- `test_signing_room_tracks_all_parties_correctly` - Verify all parties are tracked accurately
- `test_protocol_aborts_on_invalid_message` - Ensure invalid messages cause proper abort

### Chain Code and HD Keys

- `test_shared_chain_code_generation_deterministic` - Verify chain code generation is consistent
- `test_chain_code_exchange_between_parties_secure` - Ensure chain code exchange doesn't leak secrets
- `test_hd_child_key_derivation_with_index` - Test child key derivation with specific indices
- `test_hd_derivation_entropy_sufficient` - Ensure derived keys have proper entropy
- `test_hd_public_key_derivation_matches_private` - Verify public child key matches derived private key

### Attack Prevention

- `test_bitforge_attack_prevention_with_small_factors` - Verify protection against small factor attack on Paillier modulus
- `test_tsshock_attack_prevention_in_dlog_proof` - Ensure dlog proof forgery is prevented
- `test_small_subgroup_attack_prevention_eddsa` - Verify EdDSA key clamping prevents small subgroup attacks
- `test_rogue_key_attack_prevention` - Ensure malicious parties cannot manipulate shared public key
- `test_message_plus_q_forgery_prevention` - Verify message+i*q forgery is prevented

### Cross-Protocol Tests

- `test_same_parties_can_run_both_ecdsa_and_eddsa` - Verify parties can participate in both protocols
- `test_key_isolation_between_ecdsa_and_eddsa` - Ensure ECDSA and EdDSA keys are separate
- `test_manager_handles_concurrent_protocols` - Verify manager can handle both protocols simultaneously

## Performance and Stress Test Cases

### Scalability

- `test_maximum_allowed_parties_respected` - Verify MAX_ALLOWED_PARTIES limit is enforced
- `test_protocol_performance_with_maximum_parties` - Ensure reasonable performance at maximum scale
- `test_signing_room_handles_many_concurrent_sessions` - Verify multiple signing sessions can run

### Network and Timing

- `test_protocol_completes_within_timeout_bounds` - Verify protocols complete in reasonable time
- `test_delay_values_configurable_via_environment` - Ensure delays can be adjusted
- `test_protocol_handles_slow_party_gracefully` - Verify slow parties don't break protocol

## Security Best Practices Validation

### Cryptographic Primitives

- `test_random_number_generation_quality` - Verify RNG produces cryptographically secure randomness
- `test_paillier_modulus_size_sufficient` - Ensure Paillier keys meet security requirements (2048+ bits)
- `test_elliptic_curve_operations_constant_time` - Verify timing attack resistance
- `test_zero_knowledge_proofs_sound_and_complete` - Validate ZK proof correctness

### Key Management

- `test_private_keys_never_logged_or_exposed` - Ensure private keys don't appear in logs/errors
- `test_key_file_encryption_uses_aes256_gcm` - Verify key files are properly encrypted
- `test_key_file_permissions_restrictive` - Ensure key files have proper file permissions
- `test_key_erasure_on_error_conditions` - Verify keys are cleared from memory on errors

### Input Sanitization

- `test_all_public_functions_validate_inputs` - Comprehensive input validation check
- `test_boundary_conditions_handled_correctly` - Verify edge cases (0, max values, etc.)
- `test_malformed_messages_rejected_gracefully` - Ensure malformed inputs don't cause crashes
- `test_integer_overflow_prevention` - Verify no integer overflow vulnerabilities

## Observations and Recommendations Test Cases

### KS-CHL-O-01: Outdated Dependencies

- `test_no_known_vulnerabilities_in_dependencies` - Run cargo audit and verify clean results
- `test_dependencies_up_to_date` - Check for newer versions of critical dependencies

### KS-CHL-O-02: Best Secure Code Practice

- `test_no_unused_variables_in_production_code` - Verify code cleanliness
- `test_consistent_reference_usage` - Ensure consistent single/double referencing
- `test_functions_have_appropriate_visibility` - Verify pub fn is only used when necessary
- `test_magic_numbers_replaced_with_constants` - Ensure delays and constants are configurable

### KS-CHL-O-03: Security Concerns on GG18 over Ed25519

- `test_gg18_ecdsa_security_proofs_hold` - Verify GG18 security for ECDSA
- `test_eddsa_protocol_uses_appropriate_zkproofs` - Ensure ZK proofs match EdDSA requirements
- `test_consider_frost_protocol_for_eddsa` - Document recommendation to migrate to FROST

### KS-CHL-O-05: Bitforge Attack and Prime Generation

- `test_prime_generation_uses_secure_method` - Verify prime generation follows best practices
- `test_primes_checked_up_to_2_25` - Confirm small factor check covers appropriate range
- `test_safe_prime_generation_for_strong_rsa` - Verify safe primes when required

### KS-CHL-O-06: TSSHOCK Attack and Dlog Proof

- `test_rho_randomly_chosen_in_dlog_proof` - Verify rho is not manipulatable
- `test_dlog_proof_immune_to_c_split_attack` - Ensure Fiat-Shamir transformation is sound
- `test_eddsa_no_mta_conversion_required` - Verify EdDSA doesn't need MtA (no vulnerability)

## End-to-End Integration Scenarios

### Complete Workflow Tests

- `test_complete_ecdsa_workflow_keygen_to_signature` - Full ECDSA flow from keygen through signing
- `test_complete_eddsa_workflow_keygen_to_signature` - Full EdDSA flow from keygen through signing
- `test_complete_hd_workflow_with_child_key_signing` - Full HD workflow including child key usage
- `test_multiple_sequential_signatures_with_hd_keys` - Multiple child keys derived and used

### Real-World Scenarios

- `test_bitcoin_transaction_signing_with_ecdsa` - Simulate Bitcoin transaction signing
- `test_ethereum_transaction_signing_with_ecdsa` - Simulate Ethereum transaction signing
- `test_solana_transaction_signing_with_eddsa` - Simulate Solana transaction signing
- `test_key_rotation_scenario` - Simulate key rotation process
- `test_party_replacement_in_threshold_group` - Simulate replacing a party in threshold group

### Failure and Recovery Scenarios

- `test_recovery_from_network_partition` - Verify behavior when network splits
- `test_protocol_abort_and_restart` - Ensure protocols can be safely aborted and restarted
- `test_corrupted_state_detection_and_rejection` - Verify corrupted state is detected
- `test_malicious_party_detection_and_exclusion` - Ensure malicious behavior is detected

## Compliance and Standards Tests

### BIP32 Compliance

- `test_bip32_master_key_generation` - Verify master key follows BIP32
- `test_bip32_child_key_derivation_normal` - Test normal (non-hardened) derivation
- `test_bip32_child_key_derivation_hardened` - Test hardened derivation
- `test_bip32_public_key_derivation` - Verify public parent → public child derivation

### RFC 8032 Compliance (Ed25519)

- `test_rfc8032_key_generation` - Verify Ed25519 key generation per RFC
- `test_rfc8032_signing_procedure` - Verify signing follows RFC 8032
- `test_rfc8032_verification_procedure` - Verify signature verification per RFC
- `test_rfc8032_test_vectors` - Run official RFC 8032 test vectors

### GG18 Protocol Compliance

- `test_gg18_phase1_key_generation` - Verify Phase 1 follows GG18 spec
- `test_gg18_phase2_vss_commitment` - Verify Phase 2 VSS commitments
- `test_gg18_phase3_dlog_proof` - Verify Phase 3 dlog proofs
- `test_gg18_phase4_feldman_vss` - Verify Phase 4 Feldman VSS
- `test_gg18_signing_phase1_to_phase5` - Verify all signing phases

## Code Coverage and Quality

### Coverage Targets

- `test_coverage_exceeds_80_percent` - Verify overall test coverage > 80%
- `test_critical_paths_have_100_percent_coverage` - Ensure key security code fully covered
- `test_all_error_paths_covered` - Verify error handling is tested

### Code Quality

- `test_no_compiler_warnings_in_release_build` - Ensure clean compilation
- `test_clippy_lints_pass` - Verify Rust clippy lints pass
- `test_documentation_complete_for_public_api` - Ensure all public functions documented