import { randomUUID } from 'node:crypto';
import {
  CategoryExistsError,
  DefinitionExistsError,
  ManufacturerExistsError,
  ModelExistsError,
  SpecificationExistsError,
  type EquipmentCategory,
  type EquipmentKnowledgeRepository,
  type EquipmentModel,
  type EquipmentModelStatus,
  type EquipmentSpecification,
  type Manufacturer,
  type SpecificationDefinition,
  type SpecificationSource,
  type SpecificationValue,
  type SpecificationValueType,
  type SpecificationVerification,
  type Unit,
} from '../domain';

type SpecificationRow = Omit<EquipmentSpecification, 'definitionCode' | 'source'>;

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export class InMemoryEquipmentKnowledgeRepository implements EquipmentKnowledgeRepository {
  readonly categories: EquipmentCategory[] = [];
  readonly manufacturers: Manufacturer[] = [];
  readonly definitions: SpecificationDefinition[] = [];
  readonly models: EquipmentModel[] = [];
  readonly specifications: SpecificationRow[] = [];
  readonly sources: SpecificationSource[] = [];

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

  async listModels(page: { limit: number; offset: number }): Promise<{
    items: EquipmentModel[];
    total: number;
  }> {
    const manufacturerName = (m: EquipmentModel) =>
      this.manufacturers.find((x) => x.id === m.manufacturerId)?.name.toLowerCase() ?? '';
    const sorted = this.models
      .map((m) => ({ ...m }))
      .sort(
        (a, b) =>
          byText(manufacturerName(a), manufacturerName(b)) ||
          byText(a.modelName.toLowerCase(), b.modelName.toLowerCase()) ||
          byText(a.id, b.id),
      );
    return { items: sorted.slice(page.offset, page.offset + page.limit), total: sorted.length };
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

  private withCode(row: SpecificationRow): EquipmentSpecification {
    const definition = this.definitions.find((d) => d.id === row.definitionId);
    const source = this.sources.find((s) => s.id === row.sourceId);
    return {
      ...row,
      definitionCode: definition?.code ?? '',
      source: source
        ? {
            id: source.id,
            sourceType: source.sourceType,
            sourceName: source.sourceName,
            referenceUrl: source.referenceUrl,
          }
        : null,
    };
  }
}
