interface Promise<T> {
    then<>(onfulfilled?: ((value: T) => T)): Promise<T>;
    catch(onrejected?: ((reason: any) => T)): Promise<T>;
}