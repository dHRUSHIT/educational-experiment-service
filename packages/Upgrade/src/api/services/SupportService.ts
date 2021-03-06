import { Service } from 'typedi';
import { Logger, LoggerInterface } from '../../decorators/Logger';
import { ExperimentAssignmentService } from './ExperimentAssignmentService';
import { IExperimentAssignment } from 'upgrade_types';

@Service()
export class SupportService {
  constructor(
    @Logger(__filename) private log: LoggerInterface,
    public experimentAssignmentService: ExperimentAssignmentService
  ) {}

  public async getAssignments(userId: string, context: string): Promise<IExperimentAssignment[]> {
    this.log.info('Get all assignments');
    return this.experimentAssignmentService.getAllExperimentConditions(userId, context, false);
  }
}
