export interface IEffectProcessor{
    processEffect(effectData: any): Promise<any>;
}