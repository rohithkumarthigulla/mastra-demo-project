import { randomUUID } from 'node:crypto';
import {
  CapabilityExistsError,
  CategoryExistsError,
  ConstructionTaskExistsError,
  DefinitionExistsError,
  LinkExistsError,
  ManufacturerExistsError,
  ModelExistsError,
  SpecificationExistsError,
  type Capability,
  type CapabilityImportance,
  type CapabilityLink,
  type CapabilityModel,
  type CapabilityTask,
  type CategoryTask,
  type ConstructionTask,
  type EquipmentCategory,
  type EquipmentKnowledgeRepository,
  type EquipmentModel,
  type EquipmentModelStatus,
  type EquipmentSpecification,
  type LinkVerification,
  type Manufacturer,
  type ModelSearchCriteria,
  type SpecConstraint,
  type SpecificationDefinition,
  type SpecificationSource,
  type SpecificationValue,
  type SpecificationValueType,
  type SpecificationVerification,
  type TaskCapability,
  type TaskCategory,
  type TaskSuitability,
  type Unit,
} from '../domain';

type SpecificationRow = Omit<EquipmentSpecification, 'definitionCode' | 'source'>;
type ModelCapabilityRow = { modelId: string; capabilityId: string } & LinkVerification;
type CategoryCapabilityRow = { categoryId: string; capabilityId: string } & LinkVerification;
type TaskCapabilityRow = { taskId: string; capabilityId: string; importance: CapabilityImportance };
type TaskCategoryRow = { taskId: string; categoryId: string; suitability: TaskSuitability };

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export class InMemoryEquipmentKnowledgeRepository implements EquipmentKnowledgeRepository {
  readonly categories: EquipmentCategory[] = [];
  readonly manufacturers: Manufacturer[] = [];
  readonly definitions: SpecificationDefinition[] = [];
  readonly models: EquipmentModel[] = [];
  readonly specifications: SpecificationRow[] = [];
  readonly sources: SpecificationSource[] = [];
  readonly capabilities: Capability[] = [];
  readonly constructionTasks: ConstructionTask[] = [];
  readonly modelCapabilities: ModelCapabilityRow[] = [];
  readonly categoryCapabilities: CategoryCapabilityRow[] = [];
  readonly taskCapabilities: TaskCapabilityRow[] = [];
  readonly taskCategories: TaskCategoryRow[] = [];

  constructor(private readonly now: () => Date = () => new Date()) {}

  private stamp() {
    const now = this.now();
    return { id: randomUUID(), createdAt: now, updatedAt: now };
  }

  async createCategory(input: { code: string; displayName: string }): Promise<EquipmentCategory> {
    if (this.categories.some((c) => c.code === input.code)) throw new CategoryExistsError();
    const row = { ...this.stamp(), ...input };
    this.categories.push(row);
    return { ...row };
  }

  async listCategories(): Promise<EquipmentCategory[]> {
    return this.categories.map((c) => ({ ...c })).sort((a, b) => byText(a.code, b.code));
  }

  async findCategoryById(id: string): Promise<EquipmentCategory | null> {
    const row = this.categories.find((c) => c.id === id);
    return row ? { ...row } : null;
  }

  async findCategoryByCode(code: string): Promise<EquipmentCategory | null> {
    const row = this.categories.find((c) => c.code === code);
    return row ? { ...row } : null;
  }

  async createSource(
    input: Omit<SpecificationSource, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SpecificationSource> {
    const row = { ...this.stamp(), ...input };
    this.sources.push(row);
    return { ...row };
  }

  async listSources(): Promise<SpecificationSource[]> {
    return this.sources
      .map((s) => ({ ...s }))
      .sort(
        (a, b) =>
          byText(a.sourceType, b.sourceType) ||
          byText(a.sourceName.toLowerCase(), b.sourceName.toLowerCase()) ||
          byText(a.id, b.id),
      );
  }

  async findSourceById(id: string): Promise<SpecificationSource | null> {
    const row = this.sources.find((s) => s.id === id);
    return row ? { ...row } : null;
  }

  async createManufacturer(input: { name: string }): Promise<Manufacturer> {
    if (await this.findManufacturerByName(input.name)) throw new ManufacturerExistsError();
    const row = { ...this.stamp(), ...input };
    this.manufacturers.push(row);
    return { ...row };
  }

  async listManufacturers(): Promise<Manufacturer[]> {
    return this.manufacturers
      .map((m) => ({ ...m }))
      .sort((a, b) => byText(a.name.toLowerCase(), b.name.toLowerCase()) || byText(a.id, b.id));
  }

  async findManufacturerById(id: string): Promise<Manufacturer | null> {
    const row = this.manufacturers.find((m) => m.id === id);
    return row ? { ...row } : null;
  }

  async findManufacturerByName(name: string): Promise<Manufacturer | null> {
    const row = this.manufacturers.find((m) => m.name.toLowerCase() === name.toLowerCase());
    return row ? { ...row } : null;
  }

  async createDefinition(input: {
    code: string;
    displayName: string;
    valueType: SpecificationValueType;
    canonicalUnit: Unit | null;
  }): Promise<SpecificationDefinition> {
    if (this.definitions.some((d) => d.code === input.code)) throw new DefinitionExistsError();
    const row = { ...this.stamp(), ...input };
    this.definitions.push(row);
    return { ...row };
  }

  async listDefinitions(): Promise<SpecificationDefinition[]> {
    return this.definitions.map((d) => ({ ...d })).sort((a, b) => byText(a.code, b.code));
  }

  async findDefinitionByCode(code: string): Promise<SpecificationDefinition | null> {
    const row = this.definitions.find((d) => d.code === code);
    return row ? { ...row } : null;
  }

  async createModel(input: {
    manufacturerId: string;
    categoryId: string;
    modelName: string;
    modelCode: string | null;
    status: EquipmentModelStatus;
  }): Promise<EquipmentModel> {
    if (await this.findModelByName(input.manufacturerId, input.modelName)) {
      throw new ModelExistsError();
    }
    const row = { ...this.stamp(), ...input };
    this.models.push(row);
    return { ...row };
  }

  async searchModels(criteria: ModelSearchCriteria): Promise<{
    items: EquipmentModel[];
    total: number;
  }> {
    const manufacturerName = (m: EquipmentModel) =>
      this.manufacturers.find((x) => x.id === m.manufacturerId)?.name.toLowerCase() ?? '';
    const contains = (value: string | null, text: string) =>
      value !== null && value.toLowerCase().includes(text.toLowerCase());
    const satisfies = (m: EquipmentModel, spec: SpecConstraint) =>
      this.specifications.some(
        (s) =>
          s.modelId === m.id &&
          s.definitionId === spec.definitionId &&
          (criteria.verificationStatus === undefined ||
            s.verificationStatus === criteria.verificationStatus) &&
          (spec.bound === 'min'
            ? s.normalizedMax !== null && s.normalizedMax >= spec.value
            : s.normalizedMin !== null && s.normalizedMin <= spec.value),
      );
    const sorted = this.models
      .filter(
        (m) =>
          m.status === criteria.status &&
          (criteria.categoryId === undefined || m.categoryId === criteria.categoryId) &&
          (criteria.manufacturer === undefined ||
            manufacturerName(m) === criteria.manufacturer.toLowerCase()) &&
          (criteria.model === undefined ||
            contains(m.modelName, criteria.model) ||
            contains(m.modelCode, criteria.model)) &&
          criteria.specs.every((spec) => satisfies(m, spec)),
      )
      .map((m) => ({ ...m }))
      .sort(
        (a, b) =>
          byText(manufacturerName(a), manufacturerName(b)) ||
          byText(a.modelName.toLowerCase(), b.modelName.toLowerCase()) ||
          byText(a.id, b.id),
      );
    return {
      items: sorted.slice(criteria.offset, criteria.offset + criteria.limit),
      total: sorted.length,
    };
  }

  async findModelById(id: string): Promise<EquipmentModel | null> {
    const row = this.models.find((m) => m.id === id);
    return row ? { ...row } : null;
  }

  async findModelByName(manufacturerId: string, modelName: string): Promise<EquipmentModel | null> {
    const row = this.models.find(
      (m) =>
        m.manufacturerId === manufacturerId &&
        m.modelName.toLowerCase() === modelName.toLowerCase(),
    );
    return row ? { ...row } : null;
  }

  async createSpecification(
    input: { modelId: string; definitionId: string } & SpecificationValue &
      SpecificationVerification,
  ): Promise<EquipmentSpecification> {
    if (
      this.specifications.some(
        (s) => s.modelId === input.modelId && s.definitionId === input.definitionId,
      )
    ) {
      throw new SpecificationExistsError();
    }
    const row = { ...this.stamp(), ...input };
    this.specifications.push(row);
    return this.withCode(row);
  }

  async findSpecification(
    modelId: string,
    specificationId: string,
  ): Promise<EquipmentSpecification | null> {
    const row = this.specifications.find((s) => s.modelId === modelId && s.id === specificationId);
    return row ? this.withCode(row) : null;
  }

  async updateSpecification(
    specificationId: string,
    value: SpecificationValue & SpecificationVerification,
    updatedAt: Date,
  ): Promise<EquipmentSpecification | null> {
    const row = this.specifications.find((s) => s.id === specificationId);
    if (!row) return null;
    Object.assign(row, value, { updatedAt });
    return this.withCode(row);
  }

  async listSpecifications(modelId: string): Promise<EquipmentSpecification[]> {
    return this.specifications
      .filter((s) => s.modelId === modelId)
      .map((s) => this.withCode(s))
      .sort((a, b) => byText(a.definitionCode, b.definitionCode));
  }

  async createCapability(input: { code: string; displayName: string }): Promise<Capability> {
    if (this.capabilities.some((c) => c.code === input.code)) throw new CapabilityExistsError();
    const row = { ...this.stamp(), ...input };
    this.capabilities.push(row);
    return { ...row };
  }

  async listCapabilities(): Promise<Capability[]> {
    return this.capabilities.map((c) => ({ ...c })).sort((a, b) => byText(a.code, b.code));
  }

  async findCapabilityByCode(code: string): Promise<Capability | null> {
    const row = this.capabilities.find((c) => c.code === code);
    return row ? { ...row } : null;
  }

  async createConstructionTask(input: {
    code: string;
    displayName: string;
  }): Promise<ConstructionTask> {
    if (this.constructionTasks.some((t) => t.code === input.code)) {
      throw new ConstructionTaskExistsError();
    }
    const row = { ...this.stamp(), ...input };
    this.constructionTasks.push(row);
    return { ...row };
  }

  async listConstructionTasks(): Promise<ConstructionTask[]> {
    return this.constructionTasks.map((t) => ({ ...t })).sort((a, b) => byText(a.code, b.code));
  }

  async findConstructionTaskById(id: string): Promise<ConstructionTask | null> {
    const row = this.constructionTasks.find((t) => t.id === id);
    return row ? { ...row } : null;
  }

  async findConstructionTaskByCode(code: string): Promise<ConstructionTask | null> {
    const row = this.constructionTasks.find((t) => t.code === code);
    return row ? { ...row } : null;
  }

  async addModelCapability(input: ModelCapabilityRow): Promise<CapabilityLink> {
    if (
      this.modelCapabilities.some(
        (l) => l.modelId === input.modelId && l.capabilityId === input.capabilityId,
      )
    ) {
      throw new LinkExistsError();
    }
    this.modelCapabilities.push({ ...input });
    return this.toCapabilityLink(input);
  }

  async listModelCapabilities(modelId: string): Promise<CapabilityLink[]> {
    return this.sortByCapabilityCode(
      this.modelCapabilities
        .filter((l) => l.modelId === modelId)
        .map((l) => this.toCapabilityLink(l)),
    );
  }

  async listCapabilityModels(capabilityId: string): Promise<CapabilityModel[]> {
    const manufacturerName = (m: EquipmentModel) =>
      this.manufacturers.find((x) => x.id === m.manufacturerId)?.name.toLowerCase() ?? '';
    return this.modelCapabilities
      .filter((l) => l.capabilityId === capabilityId)
      .map((l) => ({
        model: { ...this.models.find((m) => m.id === l.modelId)! },
        ...this.provenance(l),
      }))
      .sort(
        (a, b) =>
          byText(manufacturerName(a.model), manufacturerName(b.model)) ||
          byText(a.model.modelName.toLowerCase(), b.model.modelName.toLowerCase()) ||
          byText(a.model.id, b.model.id),
      );
  }

  async addCategoryCapability(input: CategoryCapabilityRow): Promise<CapabilityLink> {
    if (
      this.categoryCapabilities.some(
        (l) => l.categoryId === input.categoryId && l.capabilityId === input.capabilityId,
      )
    ) {
      throw new LinkExistsError();
    }
    this.categoryCapabilities.push({ ...input });
    return this.toCapabilityLink(input);
  }

  async listCategoryCapabilities(categoryId: string): Promise<CapabilityLink[]> {
    return this.sortByCapabilityCode(
      this.categoryCapabilities
        .filter((l) => l.categoryId === categoryId)
        .map((l) => this.toCapabilityLink(l)),
    );
  }

  async addTaskCapability(input: TaskCapabilityRow): Promise<TaskCapability> {
    if (
      this.taskCapabilities.some(
        (l) => l.taskId === input.taskId && l.capabilityId === input.capabilityId,
      )
    ) {
      throw new LinkExistsError();
    }
    this.taskCapabilities.push({ ...input });
    return { capability: this.capability(input.capabilityId), importance: input.importance };
  }

  async listTaskCapabilities(taskId: string): Promise<TaskCapability[]> {
    return this.sortByCapabilityCode(
      this.taskCapabilities
        .filter((l) => l.taskId === taskId)
        .map((l) => ({ capability: this.capability(l.capabilityId), importance: l.importance })),
    );
  }

  async listCapabilityTasks(
    capabilityId: string,
    importance: CapabilityImportance | undefined,
  ): Promise<CapabilityTask[]> {
    return this.taskCapabilities
      .filter(
        (l) =>
          l.capabilityId === capabilityId &&
          (importance === undefined || l.importance === importance),
      )
      .map((l) => ({ task: this.task(l.taskId), importance: l.importance }))
      .sort((a, b) => byText(a.task.code, b.task.code));
  }

  async addTaskCategory(input: TaskCategoryRow): Promise<TaskCategory> {
    if (
      this.taskCategories.some(
        (l) => l.taskId === input.taskId && l.categoryId === input.categoryId,
      )
    ) {
      throw new LinkExistsError();
    }
    this.taskCategories.push({ ...input });
    return { category: this.category(input.categoryId), suitability: input.suitability };
  }

  async listTaskCategories(taskId: string): Promise<TaskCategory[]> {
    return this.taskCategories
      .filter((l) => l.taskId === taskId)
      .map((l) => ({ category: this.category(l.categoryId), suitability: l.suitability }))
      .sort((a, b) => byText(a.category.code, b.category.code));
  }

  async listCategoryTasks(categoryId: string): Promise<CategoryTask[]> {
    return this.taskCategories
      .filter((l) => l.categoryId === categoryId)
      .map((l) => ({ task: this.task(l.taskId), suitability: l.suitability }))
      .sort((a, b) => byText(a.task.code, b.task.code));
  }

  private capability(id: string): Capability {
    return { ...this.capabilities.find((c) => c.id === id)! };
  }

  private task(id: string): ConstructionTask {
    return { ...this.constructionTasks.find((t) => t.id === id)! };
  }

  private category(id: string): EquipmentCategory {
    return { ...this.categories.find((c) => c.id === id)! };
  }

  private toCapabilityLink(row: { capabilityId: string } & LinkVerification): CapabilityLink {
    return { capability: this.capability(row.capabilityId), ...this.provenance(row) };
  }

  private provenance(row: LinkVerification) {
    return {
      verificationStatus: row.verificationStatus,
      sourceId: row.sourceId,
      verifiedAt: row.verifiedAt,
      source: this.sourceSummary(row.sourceId),
    };
  }

  private sortByCapabilityCode<T extends { capability: Capability }>(rows: T[]): T[] {
    return rows.sort((a, b) => byText(a.capability.code, b.capability.code));
  }

  private sourceSummary(id: string | null) {
    const source = this.sources.find((s) => s.id === id);
    return source
      ? {
          id: source.id,
          sourceType: source.sourceType,
          sourceName: source.sourceName,
          referenceUrl: source.referenceUrl,
        }
      : null;
  }

  private withCode(row: SpecificationRow): EquipmentSpecification {
    const definition = this.definitions.find((d) => d.id === row.definitionId);
    return {
      ...row,
      definitionCode: definition?.code ?? '',
      source: this.sourceSummary(row.sourceId),
    };
  }
}
