import "dotenv/config";
import { purgeOnce } from "./jobs/trashPurge.job.js";

await purgeOnce();
process.exit(0);
