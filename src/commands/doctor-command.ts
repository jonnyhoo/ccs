/**
 * Doctor Command Handler
 *
 * Handle doctor command for CCS.
 */

/**
 * Handle doctor command
 */
export async function handleDoctorCommand(): Promise<void> {
  const DoctorModule = await import('../management/doctor');
  const Doctor = DoctorModule.default;
  const doctor = new Doctor();

  await doctor.runAllChecks();

  // Exit with error code if unhealthy
  process.exit(doctor.isHealthy() ? 0 : 1);
}
