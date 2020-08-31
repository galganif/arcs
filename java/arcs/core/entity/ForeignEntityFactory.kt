package arcs.core.entity

import arcs.core.common.Id
import arcs.core.data.Capability
import arcs.core.data.RawEntity
import arcs.core.data.Schema
import arcs.core.storage.StorageKey
import arcs.core.util.Time
import java.lang.UnsupportedOperationException
import kotlin.math.roundToLong
import kotlin.reflect.typeOf


object ForeignEntityFactory2 {
    val aliveChecks = mutableMapOf<Schema, (String) -> Any>()

    fun registerExternalEntityType(schema: Schema, checker: (String) -> Any) {
        aliveChecks[schema] = checker
    }

    fun check(schema: Schema, value: String) {
        // check is alive is done by creator.
        aliveChecks[schema]!!(value) //as T // make type work?
    }
}

object ForeignEntityFactory3 {
    val aliveChecks = mutableMapOf<String, (String) -> Any>()

    fun registerExternalEntityType(namespace: String, checker: (String) -> Any) {
        aliveChecks[namespace] = checker
    }

    fun check(namespace: String, value: String): Unit {
        // check is alive is done by creator.
        aliveChecks[namespace]!!(value) //as T // make type work?
    }
}

class EntityWrapper<T:Entity>(val e:T)

object ForeignEntityFactory {
    val mmap = mutableMapOf<Schema, (String) -> Entity>()

    fun <T: Entity> registerExternalEntityType(schema: Schema, creator: (String) -> T) {
        mmap[schema] = creator
        //ForeignEntityFactory2.registerExternalEntityType(schema, creator)
    }

    fun getFor(schema: Schema, value: String): Entity {
        // check is alive is done by creator.
        //check(v is T)
        val v = mmap[schema]!!(value) // make type work?
        return v
    }
    // fun getFor(schema: Schema, value: String): Entity {
    //     return mmap[schema]!!(value)
    // }

    fun getSerializedFor(schema: Schema, value: String): RawEntity {
        return mmap[schema]!!(value).serialize()
    }

    fun check(schema: Schema, value: String) {
        checkNotNull(mmap[schema]!!(value))
    }
}

class ForeignStorageKey(
    val schema: Schema // can add an inner storage key for real storage
) : StorageKey("foreign") {
    /**
     * A unique component to the key. This is required because there may be multiple inline
     * entities stored against a single fieldName (for collections and lists).
     */

    val unique = (Math.random() * Long.MAX_VALUE).roundToLong()
    override fun toKeyString(): String = schema.name!!.name
    override fun childKeyWithComponent(component: String): StorageKey = throw UnsupportedOperationException()
}

/** Base interface for types that can be stored in a [Handle] (see [Entity] and [Reference]). */
interface Storable

interface Entity : Storable {
    /** The ID for the entity, or null if it is does not have one yet. */
    val entityId: String?

    /** The creation timestamp of the entity. Set at the same time the ID is set. */
    val creationTimestamp: Long

    /** The expiration timestamp of the entity. Set at the same time the ID is set. */
    val expirationTimestamp: Long

    /**
     * Generates a new ID for the Entity, if it doesn't already have one. Also sets creation
     * timestamp, and expiry timestamp if a ttl is given
     * */
    fun ensureEntityFields(
        idGenerator: Id.Generator,
        handleName: String,
        time: Time,
        ttl: Capability.Ttl = Capability.Ttl.Infinite()
    )

    /**
     * Takes a concrete entity class [T] and convert it to [RawEntity].
     * @param storeSchema an optional [Schema] restricting entity serialization only to fields
     * allowed by the policies.
     */
    fun serialize(storeSchema: Schema? = null): RawEntity

    /** Resets all fields to the default value. */
    fun reset()
}
