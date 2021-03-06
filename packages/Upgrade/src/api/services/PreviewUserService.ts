import { Service } from 'typedi';
import { OrmRepository } from 'typeorm-typedi-extensions';
import { Logger, LoggerInterface } from '../../decorators/Logger';
import uuid from 'uuid/v4';
import { PreviewUser } from '../models/PreviewUser';
import { PreviewUserRepository } from '../repositories/PreviewUserRepository';
import { ExplicitIndividualAssignmentRepository } from '../repositories/ExplicitIndividualAssignmentRepository';
import { ExplicitIndividualAssignment } from '../models/ExplicitIndividualAssignment';

@Service()
export class PreviewUserService {
  constructor(
    @OrmRepository() private userRepository: PreviewUserRepository,
    @OrmRepository() private explicitIndividualAssignmentRepository: ExplicitIndividualAssignmentRepository,
    @Logger(__filename) private log: LoggerInterface
  ) {}

  public async find(): Promise<PreviewUser[]> {
    this.log.info(`Find all preview users`);
    const [previewUsers, assignments] = await Promise.all([
      this.userRepository.find(),
      this.userRepository.findWithNames(),
    ]);
    return previewUsers.map((user) => {
      const doc = assignments.find((assignment) => {
        return assignment.id === user.id;
      });
      return doc ? doc : user;
    });
  }

  public async findOne(id: string): Promise<PreviewUser | undefined> {
    this.log.info(`Find user by id => ${id}`);
    const [previewUser, assignments] = await Promise.all([
      this.userRepository.findOne({ id }),
      this.userRepository.findOneById(id),
    ]);
    return assignments ? assignments : previewUser;
  }

  public getTotalCount(): Promise<number> {
    this.log.info(`Find count of preview users`);
    return this.userRepository.count();
  }

  public async findPaginated(
    skip: number,
    take: number
  ): Promise<PreviewUser[]> {
    this.log.info(`Find paginated preview users`);
    const [previewUsers, assignments] = await Promise.all([
      this.userRepository.findPaginated(skip, take),
      this.userRepository.findWithNames(),
    ]);
    return previewUsers.map((user) => {
      const doc = assignments.find((assignment) => {
        return assignment.id === user.id;
      });
      return doc ? doc : user;
    });
  }

  public create(user: Partial<PreviewUser>): Promise<PreviewUser> {
    this.log.info('Create a new user => ', user);
    user.id = user.id || uuid();

    return this.userRepository.save(user);
  }

  public update(id: string, user: PreviewUser): Promise<PreviewUser> {
    this.log.info('Update a user => ', user.toString());
    user.id = id;
    return this.userRepository.save(user);
  }

  public async delete(id: string): Promise<PreviewUser | undefined> {
    this.log.info('Delete a user => ', id.toString());
    const deletedDoc = await this.userRepository.deleteById(id);
    return deletedDoc;
  }

  public async upsertExperimentConditionAssignment(previewUser: PreviewUser): Promise<PreviewUser | undefined> {
    this.log.info('Upsert Experiment Condition Assignment => ', JSON.stringify(previewUser, undefined, 1));

    const previewDocumentWithOldAssignments = await this.findOne(previewUser.id);
    const newAssignments = previewUser.assignments;

    const assignmentDocToSave: Array<Partial<ExplicitIndividualAssignment>> =
      (newAssignments &&
        newAssignments.length > 0 &&
        newAssignments.map((assignment: ExplicitIndividualAssignment) => {
          // tslint:disable-next-line:no-shadowed-variable
          const { createdAt, updatedAt, versionNumber, ...rest } = assignment;
          rest.previewUser = previewUser;
          rest.id = rest.id || uuid();
          rest.experimentCondition = assignment.experimentCondition.id as any;
          rest.experiment = assignment.experiment.id as any;
          return rest;
        })) ||
      [];

    if (previewDocumentWithOldAssignments && previewDocumentWithOldAssignments.assignments) {
      // delete conditions which don't exist in new experiment document
      const toDeleteAssignments = [];
      previewDocumentWithOldAssignments.assignments.forEach((assignment) => {
        if (
          !assignmentDocToSave.find((doc) => {
            return doc.id === assignment.id;
          })
        ) {
          toDeleteAssignments.push(this.explicitIndividualAssignmentRepository.delete({ id: assignment.id }));
        }
      });

      // delete old assignments
      if (toDeleteAssignments.length > 0) {
        await Promise.all(toDeleteAssignments);
      }
    }

    // save new documents
    if (assignmentDocToSave.length > 0) {
      await this.explicitIndividualAssignmentRepository.save(assignmentDocToSave);
    }
    const getDocument = await this.findOne(previewUser.id);
    return getDocument;
  }
}
